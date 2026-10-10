-- Server movement validation. No client reports or punishment remotes.
local Players=game:GetService("Players")
local RunService=game:GetService("RunService")
local RS=game:GetService("ReplicatedStorage")
local config=require(RS:WaitForChild("HussR6AnimationPack").Player).Config
local remotes=RS:WaitForChild("GameRemotes")
local AntiCheat={}
local violations=Instance.new("BindableEvent")
AntiCheat.Violation=violations.Event
local states={}
local SAMPLE=.25
local BURST=8
local function finite(v)
 return v.X==v.X and v.Y==v.Y and v.Z==v.Z and math.abs(v.X)<1e6 and math.abs(v.Y)<1e6 and math.abs(v.Z)<1e6
end

-- Shared evaluator also lets us verify legitimate movement and exploit patterns.
function AntiCheat.EvaluateSample(state,position,now,speed,hovering)
 local dt=now-state.time
 if dt<=0 then return nil end
 if dt>1.5 then state.position=position state.time=now state.credit=BURST state.hover=0 return nil end
 local previous=state.position
 state.time=now
 if not finite(position) then return "Invalid position" end
 local delta=position-previous
 local distance=Vector3.new(delta.X,0,delta.Z).Magnitude
 state.credit=math.min(BURST,(state.credit or BURST)+speed*dt-distance)
 state.position=position
 if state.credit<-.5 then state.credit=0 return "Impossible movement" end
 if delta.Y>math.max(12,45*dt) then return "Unapproved teleport" end
 state.hover=hovering and (state.hover or 0)+dt or 0
 if state.hover>2.5 then return "Sustained flight" end
 return nil
end
local function reset(player,char,now)
 local root=char and char:FindFirstChild("HumanoidRootPart")
 local state={character=char,position=root and root.Position or Vector3.zero,time=now,credit=BURST,hover=0,strikes=0,grace=now+2,lastStrike=0,lastSafe=root and root.CFrame}
 states[player]=state
 return state
end
function AntiCheat.AllowTeleport(player,duration)
 local now=workspace:GetServerTimeNow()
 local state=states[player] or reset(player,player.Character,now)
 state.grace=now+(duration or 1.5)
 state.credit=BURST state.hover=0 state.blocked=false
end
function AntiCheat.RestartMonitoring(player)
 reset(player,player.Character,workspace:GetServerTimeNow())
end
function AntiCheat.CheckNow(player,force)
 local now=workspace:GetServerTimeNow()
 local char=player.Character
 local hum=char and char:FindFirstChildOfClass("Humanoid")
 local root=char and char:FindFirstChild("HumanoidRootPart")
 if not root or not hum or hum.Health<=0 then return true end
 local state=states[player]
 if not state or state.character~=char then state=reset(player,char,now) end
 local role=player:GetAttribute("PlayerRole")
 if remotes:GetAttribute("RoundState")~="Active" or (role~="Runner" and role~="Thrower") or now<state.grace or char:GetAttribute("MovementLocked") or char:GetAttribute("IsDowned") then
  state.position=root.Position state.time=now state.credit=BURST state.hover=0 state.lastSafe=root.CFrame
  return true
 end
 local dt=now-state.time
 if dt<=0 or (dt<SAMPLE and not force) then return not state.blocked end
 local multiplier=(char:GetAttribute("SecondWindUntil") or 0)>now and 1.15 or (char:GetAttribute("AdrenalineUntil") or 0)>now and 1.1 or 1
 local speed=config.MoveSpeed*multiplier*1.25
 local slideUntil=char:GetAttribute("AntiCheatSlideUntil") or 0
 if now<=slideUntil then speed=math.max(speed,config.SlideSpeed*1.2) end
 local params=RaycastParams.new()
 params.FilterType=Enum.RaycastFilterType.Exclude
 local ignore={}
 for _,p in Players:GetPlayers() do if p.Character then table.insert(ignore,p.Character) end end
 params.FilterDescendantsInstances=ignore params.RespectCanCollide=true
 local ground=workspace:Raycast(root.Position,Vector3.new(0,-8,0),params)
 local hovering=not ground and not hum.Sit and math.abs(root.Position.Y-state.position.Y)<dt*3
 local reason=AntiCheat.EvaluateSample(state,root.Position,now,speed,hovering)
 state.blocked=reason~=nil
 if not reason then
  state.strikes=math.max(0,state.strikes-dt*.5)
  state.lastSafe=root.CFrame
  return true
 end
 -- Correct the movement immediately, but only penalize repeated evidence.
 if state.lastSafe then
  root.AssemblyLinearVelocity=Vector3.zero
  root.AssemblyAngularVelocity=Vector3.zero
  root.CFrame=state.lastSafe
  state.position=root.Position
 end
 if now-state.lastStrike>8 then state.strikes=0 end
 if now-state.lastStrike>=SAMPLE then state.lastStrike=now state.strikes+=1 end
 if state.strikes>=6 and not state.penalized then
  state.penalized=true
  player:SetAttribute("AntiCheatReason",reason)
  player:SetAttribute("AntiCheatDetectedAt",now)
  warn("Movement violations: "..player.Name.." ("..reason..")")
  violations:Fire(player,reason)
 end
 return false
end
local function watch(player)
 player.CharacterAdded:Connect(function(char) reset(player,char,workspace:GetServerTimeNow()) end)
 reset(player,player.Character,workspace:GetServerTimeNow())
end
Players.PlayerAdded:Connect(watch)
for _,player in Players:GetPlayers() do watch(player) end
Players.PlayerRemoving:Connect(function(player) states[player]=nil end)
remotes:GetAttributeChangedSignal("RoundState"):Connect(function()
 if remotes:GetAttribute("RoundState")~="Active" then
  for player in pairs(states) do reset(player,player.Character,workspace:GetServerTimeNow()) end
 end
end)
local elapsed=0
RunService.Heartbeat:Connect(function(dt)
 elapsed+=dt
 if elapsed<SAMPLE then return end
 elapsed=0
 for _,player in Players:GetPlayers() do AntiCheat.CheckNow(player) end
end)
return AntiCheat
