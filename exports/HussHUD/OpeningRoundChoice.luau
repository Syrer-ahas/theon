local Players=game:GetService("Players")
local RS=game:GetService("ReplicatedStorage")
local Http=game:GetService("HttpService")
local remotes=RS:WaitForChild("GameRemotes")
local remote=remotes:FindFirstChild("OpeningChoice") or Instance.new("RemoteEvent")
remote.Name="OpeningChoice" remote.Parent=remotes
local Choice={}
local current
local throttle={}
local session=0
local function candidate(player)
 if not current or not player or not player.Parent then return false end
 for _,runner in current.runners() do if runner==player then return true end end
 return false
end
remote.OnServerEvent:Connect(function(player,kind,value,token)
 if not current or token~=session or type(kind)~="string" then return end
 local now=workspace:GetServerTimeNow()
 if now-(throttle[player] or 0)<.2 then return end
 throttle[player]=now
 if now>(remotes:GetAttribute("OpeningDeadline") or 0) then return end
 if kind=="Pick" and remotes:GetAttribute("OpeningPhase")=="Pick" and player==current.lead and type(value)=="number" then
  local target=Players:GetPlayerByUserId(value)
  if candidate(target) then current.selected=target end
 elseif kind=="Choice" and remotes:GetAttribute("OpeningPhase")=="Decision" and player==current.selected and candidate(player) and (value=="Hero" or value=="Chicken") then
  current.mode=value
 end
end)
Players.PlayerRemoving:Connect(function(p) throttle[p]=nil end)
local function list()
 local candidates={}
 for _,runner in current.runners() do table.insert(candidates,{UserId=runner.UserId,Name=runner.Name,DisplayName=runner.DisplayName}) end
 table.sort(candidates,function(a,b) return a.Name:lower()<b.Name:lower() end)
 remotes:SetAttribute("OpeningCandidates",Http:JSONEncode(candidates))
end
function Choice.Run(lead,runners)
 session+=1
 current={lead=lead,runners=runners}
 remotes:SetAttribute("OpeningSession",session)
 remotes:SetAttribute("OpeningSelected",nil)
 remotes:SetAttribute("OpeningLead",lead.UserId)
 remotes:SetAttribute("OpeningDeadline",workspace:GetServerTimeNow()+12)
 list()
 remotes:SetAttribute("OpeningPhase","Pick")
 while lead.Parent and #runners()>0 and not current.selected and workspace:GetServerTimeNow()<(remotes:GetAttribute("OpeningDeadline") or 0) do
  list() task.wait(.2)
 end
 if not lead.Parent or #runners()==0 then current=nil remotes:SetAttribute("OpeningPhase","") return nil end
 if not candidate(current.selected) then current.selected=runners()[1] end
 local chosen=current.selected
 remotes:SetAttribute("OpeningSelected",chosen.UserId)
 remotes:SetAttribute("OpeningDeadline",workspace:GetServerTimeNow()+10)
 remotes:SetAttribute("OpeningPhase","Decision")
 while lead.Parent and candidate(chosen) and not current.mode and workspace:GetServerTimeNow()<(remotes:GetAttribute("OpeningDeadline") or 0) do task.wait(.1) end
 if not lead.Parent or #runners()==0 then current=nil remotes:SetAttribute("OpeningPhase","") return nil end
 local result={Player=candidate(chosen) and chosen or runners()[1],Mode=candidate(chosen) and (current.mode or "Chicken") or "Chicken"}
 current=nil
 remotes:SetAttribute("OpeningPhase","")
 return result
end
return Choice
