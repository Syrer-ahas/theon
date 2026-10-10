-- Title progress is awarded by server gameplay events, never by client requests.
local Players=game:GetService("Players")
local RS=game:GetService("ReplicatedStorage")
local RunService=game:GetService("RunService")
local Catalog=require(RS:WaitForChild("HussTitleCatalog"))
local keys={"Wins","Tags","Catches","Slides","LastWins","ValleyWins","CanyonWins","ComebackWins"}
local profiles={}
local Progress={}
local store
if not RunService:IsStudio() then
 store=game:GetService("DataStoreService"):GetDataStore("HussTitleAchievements_v1")
end
local function cleanStats(value)
 local stats={}
 for _,key in ipairs(keys) do
  local n=type(value)=="table" and value[key] or 0
  stats[key]=type(n)=="number" and n==n and math.clamp(math.floor(n),0,1e9) or 0
 end
 return stats
end
function Progress.Evaluate(stats)
 local owned={}
 for _,item in ipairs(Catalog.Items) do
  local earned=true
  for _,r in ipairs(item.Requirements) do if (stats[r.Key] or 0)<r.Goal then earned=false break end end
  owned[item.Id]=earned
 end
 return owned
end
local function publish(player,profile,announce)
 local previous=profile.Owned or {}
 profile.Owned=profile.Ready and Progress.Evaluate(profile.Stats) or {}
 for _,key in ipairs(keys) do player:SetAttribute("TitleProgress_"..key,profile.Stats[key]) end
 for _,item in ipairs(Catalog.Items) do
  local earned=profile.Owned[item.Id]==true
  player:SetAttribute("OwnedTitle_"..item.Id,earned)
  if earned and not previous[item.Id] and announce then
   local event=RS.GameRemotes:FindFirstChild("HudAction")
   if event then event:FireClient(player,"TitleEarned",item.Name) end
  end
 end
 if not profile.Owned[profile.Equipped] then profile.Equipped="" end
 player:SetAttribute("EquippedTitle",profile.Equipped)
 player:SetAttribute("TitlesReady",profile.Ready)
 player:SetAttribute("TitlesPersistence",profile.Persistence)
end
function Progress.Attach(player)
 if profiles[player] then return end
 local profile={Stats=cleanStats(),Pending=cleanStats(),Equipped="",Owned={},Ready=store==nil,Persistence=store and "Loading" or "Studio",SaveBusy=false}
 profiles[player]=profile
 publish(player,profile,false)
 if not store then return end
 task.spawn(function()
  local ok,data=pcall(function() return store:GetAsync("Player_"..player.UserId) end)
  if profiles[player]~=profile then return end
  if ok then
   local saved=cleanStats(type(data)=="table" and data.Stats)
   for _,key in ipairs(keys) do profile.Stats[key]=saved[key]+profile.Pending[key] end
   profile.Equipped=type(data)=="table" and type(data.Equipped)=="string" and data.Equipped or ""
   profile.Persistence="Saved"
  else
   -- Never overwrite an existing save when loading fails.
   profile.Persistence="Unavailable"
   warn("Title progress could not load for",player.UserId)
  end
  profile.Ready=true publish(player,profile,false)
 end)
end
function Progress.Record(player,kind,context)
 local profile=profiles[player]
 if not profile then return end
 local key=({Win="Wins",Tag="Tags",Catch="Catches",Slide="Slides"})[kind]
 if not key then return end
 local function add(k)
  profile.Stats[k]+=1 profile.Pending[k]+=1
 end
 add(key)
 if kind=="Win" and type(context)=="table" then
  if context.LastDodger then add("LastWins") end
  if context.Map=="Classic Valley" then add("ValleyWins") end
  if context.Map=="Desert Canyon" then add("CanyonWins") end
  if (context.Rounds or 0)>=3 then add("ComebackWins") end
 end
 publish(player,profile,true)
end
function Progress.Equip(player,id)
 local profile=profiles[player]
 if not profile or not profile.Ready or type(id)~="string" then return false end
 if id~="" and not profile.Owned[id] then return false end
 profile.Equipped=id profile.Dirty=true
 publish(player,profile,false)
 return true
end
function Progress.Save(player)
 local profile=profiles[player]
 if not store or not profile or not profile.Ready or profile.Persistence~="Saved" then return end
 local deadline=os.clock()+20
 while profile.SaveBusy and os.clock()<deadline do task.wait(.05) end
 if profile.SaveBusy then return end
 local snapshot=cleanStats(profile.Pending)
 local dirty=profile.Dirty
 local any=dirty
 for _,key in ipairs(keys) do if snapshot[key]>0 then any=true end end
 if not any then return end
 profile.SaveBusy=true
 local selected=profile.Equipped
 local ok,result=pcall(function()
  return store:UpdateAsync("Player_"..player.UserId,function(old)
   local merged=cleanStats(type(old)=="table" and old.Stats)
   for _,key in ipairs(keys) do merged[key]+=snapshot[key] end
   return {Version=1,Stats=merged,Equipped=selected}
  end)
 end)
 if ok then
  for _,key in ipairs(keys) do
   profile.Pending[key]=math.max(0,profile.Pending[key]-snapshot[key])
   profile.Stats[key]=cleanStats(result.Stats)[key]+profile.Pending[key]
  end
  if profile.Equipped==selected then profile.Dirty=false end
  if player.Parent then publish(player,profile,false) end
 else warn("Title progress save failed for",player.UserId) end
 profile.SaveBusy=false
end
Players.PlayerRemoving:Connect(function(player)
 Progress.Save(player) profiles[player]=nil
end)
game:BindToClose(function()
 local waiting=0
 for player in pairs(profiles) do waiting+=1 task.spawn(function() Progress.Save(player) waiting-=1 end) end
 local deadline=os.clock()+25
 while waiting>0 and os.clock()<deadline do task.wait(.1) end
end)
task.spawn(function()
 while true do
  task.wait(60)
  for player in pairs(profiles) do task.spawn(Progress.Save,player) end
 end
end)
return Progress
