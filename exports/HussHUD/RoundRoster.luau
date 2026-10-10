
local Roster={}
Roster.__index=Roster
function Roster.new() return setmetatable({Members={}},Roster) end
function Roster:Begin(players)
 self.Members={} for _,player in ipairs(players) do self.Members[player]=true end
end
function Roster:Contains(player) return self.Members[player]==true end
function Roster:Remove(player) self.Members[player]=nil end
function Roster:WithRole(role)
 local result={}
 for p in pairs(self.Members) do
  local char=p.Character local hum=char and char:FindFirstChildOfClass("Humanoid")
  if p.Parent and p:GetAttribute("PlayerRole")==role and hum and hum.Health>0 then table.insert(result,p) end
 end
 return result
end
function Roster:Outcome()
 local runners=self:WithRole("Runner") local throwers=self:WithRole("Thrower")
 if #runners==0 and #throwers==0 then return "Cancelled",runners end
 if #runners==0 then return "Chasers",runners end
 if #throwers==0 then return "Dodgers",runners end
 return nil,runners
end
return Roster

