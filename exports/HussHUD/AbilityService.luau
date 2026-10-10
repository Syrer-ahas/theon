local Service={}
local Players=game:GetService("Players")
local RS=game:GetService("ReplicatedStorage")
local catalog=require(RS:WaitForChild("HussAbilityCatalog"))
local remote=RS.GameRemotes:FindFirstChild("AbilityAction") or Instance.new("RemoteFunction")
remote.Name="AbilityAction" remote.Parent=RS.GameRemotes
local throttle={}
function Service.Equip(p,id)
 if type(id)~="string" or (id~="" and not catalog.ById[id]) then return {OK=false} end
 p:SetAttribute("EquippedAbility",id)
 return {OK=true}
end
function Service.Use(p)
 local item=catalog.ById[p:GetAttribute("EquippedAbility")]
 local char=p.Character local hum=char and char:FindFirstChildOfClass("Humanoid")
 local role=p:GetAttribute("PlayerRole") local now=workspace:GetServerTimeNow()
 if not item or not hum or hum.Health<=0 or char:GetAttribute("MovementLocked") or char:GetAttribute("IsDowned") or RS.GameRemotes:GetAttribute("RoundState")~="Active" or (role~="Runner" and role~="Thrower") then return {OK=false,Message="Available during a match."} end
 if item.Role~="Both" and item.Role~=role then return {OK=false,Message=item.Role=="Runner" and "Dodger ability." or "Chaser ability."} end
 if now<(p:GetAttribute("AbilityReadyAt") or 0) then return {OK=false,Message="Ability recharging."} end
 -- A shared cooldown prevents changing equipment from bypassing recharge.
 p:SetAttribute("AbilityReadyAt",now+item.Cooldown)
 p:SetAttribute("AbilityActiveUntil",now+item.Duration)
 p:SetAttribute("ActiveAbility",item.Id)
 if item.Id=="Shield" then char:SetAttribute("ShieldUntil",now+4) char:SetAttribute("ShieldCharges",1)
 elseif item.Id=="Ghost" then char:SetAttribute("GhostUntil",now+.65)
 elseif item.Id=="CatchBoost" then
  char:SetAttribute("IsCatching",true) char:SetAttribute("CatchUntil",now+.85) char:SetAttribute("R6Action","Catch") char:SetAttribute("R6ActionStart",now)
  task.delay(.85,function() if char.Parent then char:SetAttribute("IsCatching",false) end end)
 elseif item.Id=="SecondWind" then char:SetAttribute("SecondWindUntil",now+3)
 elseif item.Id=="DashReset" then char:SetAttribute("DashResetAt",now)
 elseif item.Id=="QuickFire" then char:SetAttribute("QuickFireUntil",now+4)
 elseif item.Id=="PowerThrow" then char:SetAttribute("PowerThrowUntil",now+4)
 elseif item.Id=="BigBall" then char:SetAttribute("BigBallUntil",now+4)
 elseif item.Id=="Pierce" then char:SetAttribute("PierceUntil",now+4)
 elseif item.Id=="Adrenaline" then char:SetAttribute("AdrenalineUntil",now+3) end
 return {OK=true}
end
remote.OnServerInvoke=function(p,action,id)
 local now=os.clock()
 if now-(throttle[p] or -10)<.15 then return {OK=false} end throttle[p]=now
 if action=="Equip" then return Service.Equip(p,id) elseif action=="Use" then return Service.Use(p) end
 return {OK=false}
end
local function attach(p)
 if p:GetAttribute("EquippedAbility")==nil then p:SetAttribute("EquippedAbility","") end
 p:SetAttribute("AbilityReadyAt",0)
 p.CharacterAdded:Connect(function() p:SetAttribute("AbilityActiveUntil",0) p:SetAttribute("ActiveAbility","") end)
end
Players.PlayerAdded:Connect(attach)
Players.PlayerRemoving:Connect(function(p) throttle[p]=nil end)
for _,p in ipairs(Players:GetPlayers()) do attach(p) end
return Service
