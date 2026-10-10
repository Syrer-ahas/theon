-- RoundManager: 2-player loop with Map Voting and 1-crossing objective.
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Debris = game:GetService("Debris")
local RunService = game:GetService("RunService")
local slideHitbox = require(script.Parent:WaitForChild("SlideHitbox"))
local throwConfig = require(ReplicatedStorage:WaitForChild("HussThrowConfig"))
local throwMechanics = require(script.Parent:WaitForChild("ThrowMechanics"))
local ballFlight=require(script.Parent:WaitForChild("BallFlight"))
local features = require(script.Parent:WaitForChild("HudGameFeatures"))
local matchRewards=require(script.Parent:WaitForChild("MatchRewards"))
local matchWinner="Chasers"
local matchCancelled=false
local roster=require(script.Parent:WaitForChild("RoundRoster")).new()
local antiCheat=require(script.Parent:WaitForChild("HussAntiCheat"))

local remotes = ReplicatedStorage:WaitForChild("GameRemotes")
local roundStatusRemote = remotes:WaitForChild("RoundStatus")
local roleAssignedRemote = remotes:WaitForChild("RoleAssigned")
local crossingUpdateRemote = remotes:WaitForChild("CrossingUpdate")
local announcementRemote = remotes:WaitForChild("Announcement")
local throwBallRemote = remotes:WaitForChild("ThrowBall")
local catchBallRemote = remotes:WaitForChild("CatchBall")
local voteMapRemote = remotes:WaitForChild("VoteMap")
local mapVotingUpdateRemote = remotes:WaitForChild("MapVotingUpdate")

local dodgeballToolTemplate = ReplicatedStorage:WaitForChild("DodgeballTool")
local dodgeballProjTemplate = ReplicatedStorage:WaitForChild("DodgeballProjectile")

local arena = workspace:WaitForChild("Arena")
local activeMap = arena:WaitForChild("GrassMap")
local zoneADetector = activeMap:WaitForChild("ZoneADetector")
local zoneBDetector = activeMap:WaitForChild("ZoneBDetector")
local spawnRunnerA = arena:WaitForChild("SpawnRunnerA")
local spawnThrower = arena:WaitForChild("SpawnThrower")
local lobby = arena:WaitForChild("Lobby")
local lobbySpawn = lobby:WaitForChild("LobbySpawn")

-- Game Settings
local MIN_PLAYERS = 2
local INTERMISSION_DURATION = 12
local ROUND_DURATION = 90
local MAX_CROSSINGS = 1 -- HUD denominator is updated per crossing.
local CROSSING_DURATION = 30
local HERO_DURATION = 20
local openingChoice=require(script.Parent:WaitForChild("OpeningRoundChoice"))
local stage="Group"
local heroPlayer
local waveTarget="Line2"
local waveNumber=0
local lockedPlayers={}
local function lockPlayer(player)
 local char=player.Character local root=char and char:FindFirstChild("HumanoidRootPart")
 if not root or lockedPlayers[player] then return end
 lockedPlayers[player]={root=root,anchored=root.Anchored,char=char,locked=char:GetAttribute("MovementLocked")}
 -- Ground the authorized starting placement before anchoring; never anchor mid-fall.
 local hum=char:FindFirstChildOfClass("Humanoid")
 local params=RaycastParams.new()
 params.FilterType=Enum.RaycastFilterType.Exclude
 local excluded={} for _,other in Players:GetPlayers() do if other.Character then table.insert(excluded,other.Character) end end
 params.FilterDescendantsInstances=excluded params.RespectCanCollide=true
 local ground=workspace:Raycast(root.Position+Vector3.new(0,4,0),Vector3.new(0,-24,0),params)
 if hum and ground and ground.Normal.Y>.7 then
  local leg=char:FindFirstChild("Left Leg")
  local height=hum.HipHeight+root.Size.Y*.5+(hum.RigType==Enum.HumanoidRigType.R6 and leg and leg.Size.Y or 0)
  root.CFrame=CFrame.new(root.Position.X,ground.Position.Y+height,root.Position.Z)*root.CFrame.Rotation
 end
 char:SetAttribute("MovementLocked",true)
 root.AssemblyLinearVelocity=Vector3.zero root.AssemblyAngularVelocity=Vector3.zero root.Anchored=true
end
local function unlockPlayer(player)
 local data=lockedPlayers[player] if not data then return end
 lockedPlayers[player]=nil
 if data.root.Parent then data.root.Anchored=data.anchored end
 if data.char.Parent then data.char:SetAttribute("MovementLocked",data.locked) end
 antiCheat.AllowTeleport(player,.6)
end
local function unlockAll() for player in pairs(lockedPlayers) do unlockPlayer(player) end end

local GameState = "Waiting"
    remotes:SetAttribute("RoundState", "Waiting")
local RoundTimeLeft = 0
local LastThrow = {}
local roundTracker = require(script.Parent:WaitForChild("DodgerRoundTracker")).new()
remotes:SetAttribute("RoundValue", 0)
remotes:SetAttribute("LastDodgerWinRounds", 0)
local CurrentMap = "Classic Valley"
local function awardDodgerWin(winners)
    matchWinner="Dodgers"
    local count = roundTracker:DodgersWin()
    if not count then return end
    remotes:SetAttribute("LastDodgerWinRounds", count)
    for _, player in ipairs(winners) do
        local stats = player:FindFirstChild("leaderstats")
        local wins = stats and stats:FindFirstChild("Wins")
        if wins then wins.Value += 1 end
        features.Reward(player, "Win", {Map=CurrentMap, Rounds=count, LastDodger=#winners==1})
        player:SetAttribute("LastDodgerWinRounds", count)
    end
end

-- Map Options & Voting State
local MAP_LIST = {"Classic Valley", "Desert Canyon"}
local MapVotes = {}
local PlayerVotes = {}
CurrentMap = "Classic Valley"
local HttpService = game:GetService("HttpService")
local VoteCooldowns = {}
remotes:SetAttribute("MapVoteDuration", INTERMISSION_DURATION)
remotes:SetAttribute("MapVoteSession", 0)
remotes:SetAttribute("MapVoteOpen", false)
local function broadcastVotes(isOpen)
    remotes:SetAttribute("MapVoteCounts", HttpService:JSONEncode(MapVotes))
    remotes:SetAttribute("MapVoteOpen", isOpen)
    mapVotingUpdateRemote:FireAllClients(MapVotes, isOpen)
end

local function resetMapVotes()
    MapVotes = {
        ["Classic Valley"] = 0,
        ["Desert Canyon"] = 0
    }
    PlayerVotes = {}
    VoteCooldowns = {}
    remotes:SetAttribute("MapVoteSession", (remotes:GetAttribute("MapVoteSession") or 0) + 1)
    for _, player in ipairs(Players:GetPlayers()) do
        player:SetAttribute("SelectedMapVote", nil)
    end
end

local MAP_TEMPLATES = {
    ["Classic Valley"] = "GrassMap",
    ["Desert Canyon"] = "DesertMap",
}
local function applyMapTheme(mapName)
    local templateName = MAP_TEMPLATES[mapName]
    local template = templateName and ReplicatedStorage:FindFirstChild(templateName)
    if not template then warn("Missing map template: " .. tostring(mapName)) return end
    local nextMap = template:Clone()
    nextMap:SetAttribute("MapChoice", mapName)
    -- Keep the detector instances whose touch listeners are already connected.
    for _, detector in ipairs({zoneADetector, zoneBDetector}) do
        local replacement = nextMap:FindFirstChild(detector.Name, true)
        if replacement and replacement:IsA("BasePart") then
            detector.CFrame = replacement.CFrame
            detector.Size = replacement.Size
            detector.CanCollide = replacement.CanCollide
            detector.CanTouch = replacement.CanTouch
            detector.Transparency = replacement.Transparency
            replacement:Destroy()
        end
        detector.Parent = nextMap
    end
    nextMap.Name = templateName
    nextMap.Parent = arena
    local previous = activeMap
    activeMap = nextMap
    previous:Destroy()
    CurrentMap = mapName
end

-- Voting remote listener
voteMapRemote.OnServerEvent:Connect(function(player, mapChoice)
    if GameState ~= "Intermission" and GameState ~= "Waiting" then return end
    if typeof(mapChoice) ~= "string" or MapVotes[mapChoice] == nil then return end
    local now = os.clock()
    if now - (VoteCooldowns[player] or -math.huge) < 0.15 then return end
    VoteCooldowns[player] = now
    if PlayerVotes[player] == mapChoice then return end
    
    local oldVote = PlayerVotes[player]
    if oldVote and MapVotes[oldVote] then
        MapVotes[oldVote] = math.max(0, MapVotes[oldVote] - 1)
    end
    
    PlayerVotes[player] = mapChoice
    player:SetAttribute("SelectedMapVote", mapChoice)
    MapVotes[mapChoice] = (MapVotes[mapChoice] or 0) + 1
    
    broadcastVotes(true)
end)

local function getRunners() return roster:WithRole("Runner") end
local function getThrowers() return roster:WithRole("Thrower") end

local function broadcastAnnouncement(title, subtitle, colorHex)
    announcementRemote:FireAllClients(title, subtitle or "", colorHex or "#FFD700")
end

local function teleportPlayer(player, cframe)
    local char = player.Character
    if char and char:FindFirstChild("HumanoidRootPart") then
        antiCheat.AllowTeleport(player,2)
        char.HumanoidRootPart.AssemblyLinearVelocity = Vector3.zero
        char.HumanoidRootPart.CFrame = cframe + Vector3.new(0, 2, 0)
    end
end

local function updateOverheadMarker(player)
    local char = player.Character
    if not char then return end
    for _, obj in ipairs(char:GetDescendants()) do
        if obj.Name == "OverheadRoleMarker" then obj:Destroy() end
    end
end

local function updateCharacterHighlight(player, role)
    updateOverheadMarker(player, role)
local char = player.Character
    if not char then return end
    
    local hl = char:FindFirstChild("RoleHighlight")
    if role == "Lobby" or not role then
        if hl then hl:Destroy() end
        return
    end
    
    if not hl then
        hl = Instance.new("Highlight")
        hl.Name = "RoleHighlight"
        hl.Adornee = char
        hl.Parent = char
    end
    
    if role == "Runner" then
        -- Dodgers: Light Blue
        hl.OutlineColor = Color3.fromRGB(0, 205, 255)
        hl.FillColor = Color3.fromRGB(0, 205, 255)
        hl.FillTransparency = 0.88
        hl.OutlineTransparency = 0
        hl.DepthMode = Enum.HighlightDepthMode.AlwaysOnTop
    elseif role == "Thrower" then
        -- Shooters: Bright Red
        hl.OutlineColor = Color3.fromRGB(255, 25, 25)
        hl.FillColor = Color3.fromRGB(255, 25, 25)
        hl.FillTransparency = 0.88
        hl.OutlineTransparency = 0
        hl.DepthMode = Enum.HighlightDepthMode.AlwaysOnTop
    end
end

local function setPlayerRole(player, role)
    player:SetAttribute("PlayerRole", role)
    roleAssignedRemote:FireClient(player, role)
    updateCharacterHighlight(player, role)
    updateOverheadMarker(player, role)
local char = player.Character
    if not char then return end

    if role == "Thrower" then
        player:SetAttribute("CrossingReached",false) player:SetAttribute("TargetZone",nil) player:SetAttribute("InSafeZone",false)
        if not player.Backpack:FindFirstChild("DodgeballTool") and not char:FindFirstChild("DodgeballTool") then
            local tool = dodgeballToolTemplate:Clone()
            features.StyleBall(tool.Handle, player)
            tool.Parent = player.Backpack
            local hum = char:FindFirstChildOfClass("Humanoid")
            if hum then hum:EquipTool(tool) end
        end
    elseif role == "Runner" then
        player:SetAttribute("CrossingReached",false)
        player:SetAttribute("Crossings", 0)
        player:SetAttribute("TargetZone", "Line2")
        player:SetAttribute("InSafeZone", true)
        crossingUpdateRemote:FireClient(player, 0, MAX_CROSSINGS, "Line2")
        
        local t = player.Backpack:FindFirstChild("DodgeballTool") or char:FindFirstChild("DodgeballTool")
        if t then t:Destroy() end
    else
        player:SetAttribute("Crossings",0) player:SetAttribute("TargetZone",nil) player:SetAttribute("InSafeZone",false)
        local t = player.Backpack:FindFirstChild("DodgeballTool") or char:FindFirstChild("DodgeballTool")
        if t then t:Destroy() end
    end
end

-- Confirmed movement violations use the same authoritative role conversion as a tag.
antiCheat.Violation:Connect(function(player,reason)
 if GameState~="Active" or not roster:Contains(player) then return end
 local wasRunner=player:GetAttribute("PlayerRole")=="Runner"
 if player:GetAttribute("PlayerRole")=="Thrower" then
  player:Kick("Repeated unauthorized movement detected while on the chaser team.")
  return
 end
 if wasRunner then
  matchRewards.Tagged(player)
  setPlayerRole(player,"Thrower")
  antiCheat.RestartMonitoring(player)
 end
 player:SetAttribute("InSafeZone",false)
 player:SetAttribute("TargetZone",nil)
 local char=player.Character
 if char then
  char:SetAttribute("IsCatching",false)
  for _,name in ipairs({"ShieldUntil","ShieldCharges","GhostUntil","SecondWindUntil","AdrenalineUntil","QuickFireUntil","PowerThrowUntil","BigBallUntil","PierceUntil"}) do char:SetAttribute(name,0) end
 end
 teleportPlayer(player,spawnThrower.Value)
 if wasRunner then
  broadcastAnnouncement("TEAM CHANGED",player.DisplayName.." joined the Chasers after repeated movement violations.","#FF6644")
  if #getRunners()==0 then
   GameState="Ending" remotes:SetAttribute("RoundState","Ending")
   broadcastAnnouncement("CHASERS WIN!","No dodgers remain.","#FF3333")
  end
 end
end)

-- Throwing Dodgeball
throwBallRemote.OnServerEvent:Connect(function(player, targetPos)
    if GameState ~= "Active" then return end
    if typeof(targetPos) ~= "Vector3" or targetPos.X ~= targetPos.X or targetPos.Y ~= targetPos.Y or targetPos.Z ~= targetPos.Z or targetPos.Magnitude > 1e6 then return end
    if player:GetAttribute("PlayerRole") ~= "Thrower" or not roster:Contains(player) then return end
    
    local now = workspace:GetServerTimeNow()
    local throwChar=player.Character
    local fast=throwChar and (throwChar:GetAttribute("QuickFireUntil") or 0)>now
    local adrenaline=throwChar and (throwChar:GetAttribute("AdrenalineUntil") or 0)>now
    local cooldown=throwConfig.Cooldown*(fast and .5 or adrenaline and .75 or 1)
    if now - (LastThrow[player] or -math.huge) < cooldown then return end
    
    local char = player.Character
    local root = char and char:FindFirstChild("HumanoidRootPart")
    local hum = char and char:FindFirstChildOfClass("Humanoid")
    local tool = char and char:FindFirstChild("DodgeballTool")
    if not root or not hum or hum.Health <= 0 or not tool then return end
    LastThrow[player] = now

    char:SetAttribute("R6Action", "Throw")
    char:SetAttribute("R6ActionStart", workspace:GetServerTimeNow())
    
    task.delay(throwConfig.ReleaseDelay, function()
    if GameState ~= "Active" or player.Character ~= char or hum.Health <= 0 or player:GetAttribute("PlayerRole") ~= "Thrower" or tool.Parent ~= char then return end
    local ball = dodgeballProjTemplate:Clone()
    local releaseNow=workspace:GetServerTimeNow()
    if (char:GetAttribute("BigBallUntil") or 0)>releaseNow then ball.Size*=1.2 char:SetAttribute("BigBallUntil",0) end
    if (char:GetAttribute("PierceUntil") or 0)>releaseNow then ball:SetAttribute("PiercesShield",true) char:SetAttribute("PierceUntil",0) end
    local position, velocity = throwMechanics.GetLaunch(char, targetPos, ball.Size.X * .5)
    if not position then ball:Destroy() return end
    ball.Anchored=true ball.CanCollide=false ball.CanTouch=false ball.CanQuery=false
    ball.CFrame=CFrame.lookAt(position,position+velocity.Unit)
    features.StyleBall(ball, player)
    ball:SetAttribute("Shooter", player.UserId)
    ball.CollisionGroup = slideHitbox.BallGroup
    ball.Parent = workspace

    local hitDone = false
    local function tryHit(victimChar, from, to)
        if hitDone then return end
        local victimPlr = Players:GetPlayerFromCharacter(victimChar)
        
        if victimPlr and roster:Contains(victimPlr) and victimPlr ~= player and victimPlr:GetAttribute("PlayerRole") == "Runner" then
            if victimPlr:GetAttribute("InSafeZone") == true then
                return
            end
            
            if (victimChar:GetAttribute("GhostUntil") or 0)>workspace:GetServerTimeNow() then return end
            if not slideHitbox.Intersects(victimChar, from, to, ball.Size.X * .5) then
                return
            end

            if not ball:GetAttribute("PiercesShield") and (victimChar:GetAttribute("ShieldUntil") or 0)>workspace:GetServerTimeNow() and (victimChar:GetAttribute("ShieldCharges") or 0)>0 then
                victimChar:SetAttribute("ShieldCharges",0) hitDone=true ball:Destroy() return
            end
            if victimChar:GetAttribute("IsCatching") == true then
                hitDone = true
                features.Reward(victimPlr, "Catch")
                broadcastAnnouncement("BALL CAUGHT!", victimPlr.DisplayName .. " caught " .. player.DisplayName .. "'s throw!", "#55FF55")
                ball:Destroy()
                return
            end
            
            hitDone = true
            features.Reward(player, "Tag")
            victimChar:SetAttribute("R6Action", "Hit")
            victimChar:SetAttribute("R6ActionStart", workspace:GetServerTimeNow())
            
            broadcastAnnouncement("TAGGED!", player.DisplayName .. " tagged " .. victimPlr.DisplayName .. "!", "#FF4444")
            matchRewards.Tagged(victimPlr)
            setPlayerRole(victimPlr, "Thrower")
            ball:Destroy()
            
            local left = getRunners()
            if #left == 0 then
                GameState = "Ending"
    remotes:SetAttribute("RoundState", "Ending")
                broadcastAnnouncement("CHASERS WIN!", "All runners were tagged!", "#FF3333")
            end
        end
    end
    ballFlight.Start(ball,position,velocity,ballFlight.Bounds(activeMap),function(from,to)
        for _,victim in ipairs(getRunners()) do
            if victim.Character then tryHit(victim.Character,from,to) end
            if hitDone then break end
        end
    end,function() return GameState=="Active" end)
    end)
end)

local lastCatch = {}
-- Catch Attempt
catchBallRemote.OnServerEvent:Connect(function(player)
    if GameState ~= "Active" then return end
    local now = os.clock()
    local catchChar=player.Character
    local boosted=catchChar and (catchChar:GetAttribute("AdrenalineUntil") or 0)>workspace:GetServerTimeNow()
    if now - (lastCatch[player] or -math.huge) < 2.5*(boosted and .75 or 1) then return end
    lastCatch[player] = now
    local char = player.Character
    if not char or player:GetAttribute("PlayerRole") ~= "Runner" or not roster:Contains(player) then return end
    
    char:SetAttribute("R6Action", "Catch")
    char:SetAttribute("R6ActionStart", workspace:GetServerTimeNow())
    char:SetAttribute("IsCatching", true)
    char:SetAttribute("CatchUntil",math.max(char:GetAttribute("CatchUntil") or 0,workspace:GetServerTimeNow()+.45))
    task.delay(0.45, function()
        if char and workspace:GetServerTimeNow()>=(char:GetAttribute("CatchUntil") or 0) then char:SetAttribute("IsCatching", false) end
    end)
end)

-- A crossing completes at the target safe line. Only the last dodger crossing wins.
local function insideZone(root,zone)
 local q=zone.CFrame:PointToObjectSpace(root.Position)
 return math.abs(q.X)<=zone.Size.X*.5+1 and math.abs(q.Y)<=zone.Size.Y*.5+3 and math.abs(q.Z)<=zone.Size.Z*.5+1
end
local function onCrossingReached(player,crossedLine)
 if GameState~="Active" or not roster:Contains(player) or player:GetAttribute("PlayerRole")~="Runner" then return end
 if stage=="Solo" and player~=heroPlayer then return end
 if player:GetAttribute("TargetZone")~=crossedLine or player:GetAttribute("CrossingReached") then return end
 local root=player.Character and player.Character:FindFirstChild("HumanoidRootPart")
 local zone=crossedLine=="Line1" and zoneADetector or zoneBDetector
 if not root or not insideZone(root,zone) then return end
 if not antiCheat.CheckNow(player,true) then return end
 player:SetAttribute("CrossingReached",true) player:SetAttribute("InSafeZone",true)
 local count=(player:GetAttribute("Crossings") or 0)+1
 player:SetAttribute("Crossings",count)
 crossingUpdateRemote:FireClient(player,count,waveNumber,crossedLine)
 if #getRunners()==1 then
  GameState="Ending" remotes:SetAttribute("RoundState","Ending")
  local char=player.Character
  if char then char:SetAttribute("R6Action","Victory") char:SetAttribute("R6ActionStart",workspace:GetServerTimeNow()) end
  awardDodgerWin(getRunners())
  broadcastAnnouncement("DODGERS WIN!","The last dodger made it across!","#FFD700")
 end
end
task.spawn(function()
 while true do
  task.wait(.1)
  if GameState=="Active" then
   for _,player in ipairs(getRunners()) do
    local char=player.Character local root=char and char:FindFirstChild("HumanoidRootPart")
    if root then
     local inA=insideZone(root,zoneADetector) local inB=insideZone(root,zoneBDetector)
     player:SetAttribute("InSafeZone",inA or inB)
     if inA then onCrossingReached(player,"Line1") elseif inB then onCrossingReached(player,"Line2") end
    end
   end
  end
 end
end)
local function markTouch(hit,line)
 local char=hit:FindFirstAncestorOfClass("Model")
 local player=char and Players:GetPlayerFromCharacter(char)
 if player then onCrossingReached(player,line) end
end
zoneADetector.Touched:Connect(function(hit) markTouch(hit,"Line1") end)
zoneBDetector.Touched:Connect(function(hit) markTouch(hit,"Line2") end)

-- Main Cycle with Map Voting
task.spawn(function()
    while true do
        unlockAll()
        for _, p in ipairs(Players:GetPlayers()) do
            if p:GetAttribute("PlayerRole") ~= "Lobby" then
                setPlayerRole(p, "Lobby")
                teleportPlayer(p, lobbySpawn.CFrame)
            end
        end
        -- 1. WAITING FOR 2 PLAYERS
        resetMapVotes()
        remotes:SetAttribute("MapVoteTimeLeft", 0)
        broadcastVotes(true)
        while #features.EligiblePlayers() < MIN_PLAYERS do
            GameState = "Waiting"
    remotes:SetAttribute("RoundState", "Waiting")
            local currentCount = #features.EligiblePlayers()
            roundStatusRemote:FireAllClients("Waiting", currentCount, currentCount, MIN_PLAYERS)
            task.wait(1)
        end
        
        -- 2. INTERMISSION & MAP VOTING
        GameState = "Intermission"
    remotes:SetAttribute("RoundState", "Intermission")
        broadcastVotes(true)
        

        
        local aborted = false
        for t = INTERMISSION_DURATION, 1, -1 do
            if #features.EligiblePlayers() < MIN_PLAYERS then
                aborted = true
                break
            end
            RoundTimeLeft = t
            remotes:SetAttribute("MapVoteTimeLeft", t)
            roundStatusRemote:FireAllClients("Intermission", t, #getRunners(), #getThrowers())
            task.wait(1)
        end
        
        if aborted then
            broadcastVotes(false)
            continue
        end
        
        -- 3. TALLY MAP VOTES
        broadcastVotes(false)
        local winningMap = "Classic Valley"
        local highestVotes = -1
        for _, mapName in ipairs(MAP_LIST) do
            local v = MapVotes[mapName] or 0
            if v > highestVotes then
                highestVotes = v
                winningMap = mapName
            end
        end
        if highestVotes == 0 then
            winningMap = CurrentMap
        end
        
        applyMapTheme(winningMap)
        broadcastAnnouncement("MAP CHOSEN!", winningMap .. " won the vote!", "#00E5FF")
        task.wait(1.5)
        
        -- 4. Choose the opening before allowing throws or movement.
        local allPlrs=features.EligiblePlayers()
        if #allPlrs<MIN_PLAYERS then GameState="Waiting" remotes:SetAttribute("RoundState","Waiting") continue end
        roster:Begin(allPlrs)
        GameState="Choosing" remotes:SetAttribute("RoundState","Choosing")
        remotes:SetAttribute("RoundValue",roundTracker:BeginRound())
        matchWinner="Chasers" matchCancelled=false
        local chaser=table.remove(allPlrs,math.random(1,#allPlrs))
        setPlayerRole(chaser,"Thrower") teleportPlayer(chaser,spawnThrower.Value)
        lockPlayer(chaser)
        for index,runner in ipairs(allPlrs) do
         setPlayerRole(runner,"Runner")
         teleportPlayer(runner,spawnRunnerA.Value+Vector3.new((index-(#allPlrs+1)/2)*6,0,0))
         lockPlayer(runner)
        end
        remotes:SetAttribute("OpeningChoiceHint","Hero: cross alone first  ·  Chicken: cross together")
        broadcastAnnouncement("CHOOSE A PLAYER",chaser.DisplayName.." picks the opening dodger.","#FFD700")
        roundStatusRemote:FireAllClients("Choosing",12,#getRunners(),#getThrowers())
        local choice=openingChoice.Run(chaser,getRunners)
        if not choice or #getThrowers()==0 or #getRunners()==0 then
         unlockAll() matchCancelled=true
         remotes:SetAttribute("RoundValue",roundTracker:CancelRound())
         GameState="Ending" remotes:SetAttribute("RoundState","Ending")
         broadcastAnnouncement("MATCH CANCELLED","A starting player left before the crossing.","#FF4444")
         task.wait(2) continue
        end
        local participants={chaser} for _,runner in ipairs(allPlrs) do table.insert(participants,runner) end
        matchRewards.Begin(participants)
        waveTarget="Line2" waveNumber=1 heroPlayer=choice.Player
        stage=choice.Mode=="Hero" and "Solo" or "Group"
        GameState="Active" remotes:SetAttribute("RoundState","Active")
        unlockPlayer(chaser)
        if stage=="Solo" then
         unlockPlayer(heroPlayer)
         broadcastAnnouncement(heroPlayer.DisplayName.." chose HERO","Cross alone first!","#FFD700")
        else
         unlockAll()
         broadcastAnnouncement(heroPlayer.DisplayName.." chose CHICKEN","Everyone crosses together!","#FFD700")
        end
        remotes:SetAttribute("CrossingWave",waveNumber)
        remotes:SetAttribute("CrossingTarget",waveTarget)
        local deadline=workspace:GetServerTimeNow()+(stage=="Solo" and HERO_DURATION or CROSSING_DURATION)
        local function publishStage()
         remotes:SetAttribute("RoundPhase",stage)
         remotes:SetAttribute("HeroPlayer",heroPlayer and heroPlayer.UserId or nil)
         remotes:SetAttribute("CrossingDeadline",deadline)
        end
        publishStage()
        local lastStatus
        while GameState=="Active" do
         local outcome,remaining=roster:Outcome()
         if outcome then
          GameState="Ending" remotes:SetAttribute("RoundState","Ending")
          if outcome=="Dodgers" then awardDodgerWin(remaining) broadcastAnnouncement("DODGERS WIN!","No chasers remain.","#55FF55")
          elseif outcome=="Chasers" then broadcastAnnouncement("CHASERS WIN!","No dodgers remain.","#FF4444")
          else matchCancelled=true remotes:SetAttribute("RoundValue",roundTracker:CancelRound()) broadcastAnnouncement("MATCH CANCELLED","No active players remain.","#FF4444") end
          break
         end
         local runners=getRunners()
         if #runners==1 and runners[1]:GetAttribute("CrossingReached") then
          GameState="Ending" remotes:SetAttribute("RoundState","Ending")
          awardDodgerWin(runners) broadcastAnnouncement("DODGERS WIN!","The last dodger made it across!","#FFD700")
          break
         end
         local now=workspace:GetServerTimeNow()
         RoundTimeLeft=math.max(0,math.ceil(deadline-now))
         local status=stage..waveNumber..":"..RoundTimeLeft
         if status~=lastStatus then lastStatus=status roundStatusRemote:FireAllClients("Active",RoundTimeLeft,#runners,#getThrowers()) end
         if stage=="Solo" then
          local heroAlive=heroPlayer and heroPlayer:GetAttribute("PlayerRole")=="Runner" and roster:Contains(heroPlayer)
          local completed=heroAlive and heroPlayer:GetAttribute("CrossingReached")
          if completed or not heroAlive or now>=deadline then
           if heroAlive and not completed then
            matchRewards.Tagged(heroPlayer)
            setPlayerRole(heroPlayer,"Thrower")
            heroPlayer:SetAttribute("InSafeZone",false) heroPlayer:SetAttribute("TargetZone",nil)
            broadcastAnnouncement("HERO TIME EXPIRED","The hero joins the chasers.","#FF4444")
           end
           stage="Group" unlockAll()
           deadline=now+CROSSING_DURATION
           publishStage()
           broadcastAnnouncement("EVERYONE RUN!","Cross to the opposite safe line.","#55FF55")
          end
         else
          local allAcross=true
          for _,runner in ipairs(runners) do if not runner:GetAttribute("CrossingReached") then allAcross=false break end end
          if allAcross then
           waveTarget=waveTarget=="Line2" and "Line1" or "Line2"
           waveNumber+=1
           for _,runner in ipairs(runners) do
            runner:SetAttribute("CrossingReached",false) runner:SetAttribute("TargetZone",waveTarget)
            crossingUpdateRemote:FireClient(runner,runner:GetAttribute("Crossings") or 0,waveNumber,waveTarget)
           end
           deadline=now+CROSSING_DURATION
           remotes:SetAttribute("CrossingWave",waveNumber)
           remotes:SetAttribute("CrossingTarget",waveTarget)
           publishStage()
           broadcastAnnouncement("CROSSING "..waveNumber,"Turn around — cross to "..(waveTarget=="Line1" and "the first" or "the second").." safe line!","#FFD700")
          elseif now>=deadline then
           GameState="Ending" remotes:SetAttribute("RoundState","Ending")
           broadcastAnnouncement("CHASERS WIN!","The dodgers did not cross before time ran out.","#FF4444")
          end
         end
         task.wait(.1)
        end
        unlockAll()
        remotes:SetAttribute("RoundPhase","")
        
        -- 6. END OF ROUND
        matchRewards.Finish(matchWinner,matchCancelled)
        roundStatusRemote:FireAllClients("Ending", 0, #getRunners(), #getThrowers())
        task.wait(4)
    end
end)


local function attachPlayer(player)
 local function characterAdded(char)
  roster:Remove(player) setPlayerRole(player,"Lobby")
  local hum=char:WaitForChild("Humanoid",5)
  if hum then hum.Died:Connect(function()
   if roster:Contains(player) then roster:Remove(player) setPlayerRole(player,"Lobby") end
  end) end
  task.delay(.2,function()
   if player.Character==char and char.Parent then teleportPlayer(player,lobbySpawn.CFrame) updateCharacterHighlight(player,"Lobby") end
  end)
 end
 player.CharacterAdded:Connect(characterAdded)
 if player.Character then task.spawn(characterAdded,player.Character) end
end
Players.PlayerAdded:Connect(attachPlayer)
for _,player in ipairs(Players:GetPlayers()) do attachPlayer(player) end
Players.PlayerRemoving:Connect(function(player)
    local oldVote = PlayerVotes[player]
    if oldVote and MapVotes[oldVote] then
        MapVotes[oldVote] = math.max(0, MapVotes[oldVote] - 1)
    end
    PlayerVotes[player] = nil
    VoteCooldowns[player] = nil
    if GameState == "Intermission" or GameState == "Waiting" then broadcastVotes(true) end
    roster:Remove(player)
    -- The active loop resolves this round using only its original participants.
end)
