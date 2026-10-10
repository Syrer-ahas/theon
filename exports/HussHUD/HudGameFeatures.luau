local Features={}
local Players=game:GetService("Players")
local RS=game:GetService("ReplicatedStorage")
local titleCatalog=require(RS:WaitForChild("HussTitleCatalog"))
local remotes=RS:WaitForChild("GameRemotes")
local event=remotes:FindFirstChild("HudAction") or Instance.new("RemoteEvent")
event.Name="HudAction" event.Parent=remotes
local titleProgress=require(script.Parent:WaitForChild("TitleAchievements"))
local matchRewards=require(script.Parent:WaitForChild("MatchRewards"))
local ballCatalog=require(RS:WaitForChild("HussBallCatalog"))
Features.Catalog=ballCatalog.Items

local throttle={}
local function stat(p,name)
 local folder=p:FindFirstChild("leaderstats")
 if not folder then folder=Instance.new("Folder") folder.Name="leaderstats" folder.Parent=p end
 local value=folder:FindFirstChild(name)
 if not value then value=Instance.new("IntValue") value.Name=name value.Parent=folder end
 return value
end
local function setup(p)
 if p:GetAttribute("HussHUDInitialized") then return end
 p:SetAttribute("HussHUDInitialized",true)
 stat(p,"Coins") stat(p,"Gems")
 p:SetAttribute("OwnedBall_Classic",true)
 p:SetAttribute("EquippedBall",p:GetAttribute("EquippedBall") or "Classic")
 titleProgress.Attach(p)
 p:SetAttribute("AFK",false)
 p:SetAttribute("PlayerRole",p:GetAttribute("PlayerRole") or "Lobby")
 p:SetAttribute("RewardReadyAt",workspace:GetServerTimeNow()+600)
 p:SetAttribute("WelcomeRewardClaimed",false)
 p:SetAttribute("SessionTags",0) p:SetAttribute("SessionCatches",0) p:SetAttribute("SessionDodgerWins",0)
end
function Features.EligiblePlayers()
 local list={} for _,p in ipairs(Players:GetPlayers()) do local char=p.Character local hum=char and char:FindFirstChildOfClass("Humanoid") if p:GetAttribute("AFK")~=true and hum and hum.Health>0 and char:FindFirstChild("HumanoidRootPart") then table.insert(list,p) end end return list
end
function Features.StyleBall(ball,p)
 local item=ballCatalog.ById[p:GetAttribute("EquippedBall")] or ballCatalog.ById.Classic
 ball.Color=item.Color
 local old=ball:FindFirstChild("BallAppearance") if old then old:Destroy() end
 local template=RS.HussBallModels:FindFirstChild(item.Id)
 if template then
  local model=template:Clone() model.Name="BallAppearance"
  model:ScaleTo(ball.Size.X/3) model:PivotTo(ball.CFrame)
  for _,part in ipairs(model:GetDescendants()) do if part:IsA("BasePart") then
   part.Anchored=false part.CanCollide=false part.CanTouch=false part.CanQuery=false part.Massless=true
   local weld=Instance.new("WeldConstraint") weld.Part0=ball weld.Part1=part weld.Parent=part
  end end
  model.Parent=ball ball.Transparency=1
 end
 for _,o in ipairs(ball:GetDescendants()) do if o:IsA("Trail") then o.Color=ColorSequence.new(item.Color) end end
end
function Features.Reward(p,kind,context)
 local key=({Win="SessionDodgerWins",Tag="SessionTags",Catch="SessionCatches"})[kind]
 if not key then return end
 p:SetAttribute(key,(p:GetAttribute(key) or 0)+1)
 titleProgress.Record(p,kind,context)
 matchRewards.Record(p,kind)
 local coinMultiplier=(p:GetAttribute("CoinsBoostUntil") or 0)>os.time() and 2 or 1
 stat(p,"Coins").Value+=(kind=="Win" and 50 or 10)*coinMultiplier
 if kind=="Win" then stat(p,"Gems").Value+=((p:GetAttribute("GemsBoostUntil") or 0)>os.time() and 10 or 5) end
end
event.OnServerEvent:Connect(function(p,action,value)
 if type(action)~="string" then return end
 local now=os.clock() if now-(throttle[p] or -math.huge)<.15 then return end throttle[p]=now
 if action=="AFK" then
  if remotes:GetAttribute("RoundState")=="Active" then event:FireClient(p,"Notice","AFK is available after this round.") return end
  if type(value)=="boolean" then p:SetAttribute("AFK",value) end
 elseif action=="Ball" and type(value)=="string" then
  for _,item in ipairs(Features.Catalog) do if item.Id==value then
   if not p:GetAttribute("OwnedBall_"..value) then
    if item.Gamepass then event:FireClient(p,"Notice","Unlock this ball through its gamepass.") return end
    local coins=stat(p,"Coins")
    if coins.Value<item.Price then event:FireClient(p,"Notice","Not enough coins. Earn coins by winning, tagging, or catching.") return end
    coins.Value-=item.Price p:SetAttribute("OwnedBall_"..value,true)
   end
   p:SetAttribute("EquippedBall",value)
   for _,root in ipairs({p.Backpack,p.Character}) do if root then local tool=root:FindFirstChild("DodgeballTool") if tool then Features.StyleBall(tool.Handle,p) end end end
   return
  end end
 elseif action=="Title" and type(value)=="string" then
  titleProgress.Equip(p,value)
 elseif action=="Quest" and type(value)=="string" then
  local quests={Tag={"SessionTags",3,60},Catch={"SessionCatches",2,60},Win={"SessionDodgerWins",1,100}}
  local q=quests[value]
  if q and not p:GetAttribute("ClaimedQuest_"..value) and (p:GetAttribute(q[1]) or 0)>=q[2] then
   p:SetAttribute("ClaimedQuest_"..value,true) stat(p,"Coins").Value+=q[3]
  end
 elseif action=="WelcomeReward" then
  if p:GetAttribute("WelcomeRewardClaimed") or workspace:GetServerTimeNow()<(p:GetAttribute("RewardReadyAt") or math.huge) then return end
  p:SetAttribute("WelcomeRewardClaimed",true) stat(p,"Coins").Value+=200
  event:FireClient(p,"Notice","+200 coins · welcome to Huss Balley!")
 elseif action=="Emote" then
  event:FireClient(p,"Notice","Emotes are coming soon.")

 end
end)
Players.PlayerAdded:Connect(setup)
Players.PlayerRemoving:Connect(function(p) throttle[p]=nil end)
for _,p in ipairs(Players:GetPlayers()) do setup(p) end
return Features


