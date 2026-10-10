local M={}
local Players=game:GetService("Players")
local RS=game:GetService("ReplicatedStorage")
local DSS=game:GetService("DataStoreService")
local Run=game:GetService("RunService")
local remotes=RS.GameRemotes
local result=Instance.new("RemoteEvent") result.Name="MatchResults" result.Parent=remotes
local spin=Instance.new("RemoteFunction") spin.Name="PrizeSpin" spin.Parent=remotes
local profiles={} local match={} local started=0
local store=not Run:IsStudio() and DSS:GetDataStore("HussXPSpin_v1") or nil
M.Prizes={
 {Name="x2 Gems · 25m",Weight=15,Kind="GemsBoost",Amount=1500,Color=Color3.fromRGB(0,132,255)},
 {Name="x2 Coins · 15m",Weight=20,Kind="CoinsBoost",Amount=900,Color=Color3.fromRGB(0,132,255)},
 {Name="Storm Talon",Weight=8,Kind="Ball",Id="Storm",Color=Color3.fromRGB(240,245,250)},
 {Name="500 Coins",Weight=20,Kind="Coins",Amount=500,Color=Color3.fromRGB(0,132,255)},
 {Name="250 Coins",Weight=35,Kind="Coins",Amount=250,Color=Color3.fromRGB(0,132,255)},
 {Name="Molten Fang",Weight=2,Kind="Ball",Id="Molten",Color=Color3.fromRGB(255,235,0)}
}
local function stat(p,n,value)
 local f=p:FindFirstChild("leaderstats") if not f then f=Instance.new("Folder") f.Name="leaderstats" f.Parent=p end
 local s=f:FindFirstChild(n) if not s then s=Instance.new("IntValue") s.Name=n s.Value=value or 0 s.Parent=f end return s
end
local function level(xp)
 local l=1 local required=100
 while xp>=required do xp-=required l+=1 required=100+(l-1)*30 end
 return l,xp,required
end
local function sync(p)
 local d=profiles[p] if not d then return end
 local l,x,need=level(d.XP) stat(p,"Level",1).Value=l
 p:SetAttribute("LevelXP",x) p:SetAttribute("LevelXPRequired",need)
 p:SetAttribute("NextFreeSpin",d.Next) p:SetAttribute("SpinProfileReady",d.Ready)
 p:SetAttribute("CoinsBoostUntil",d.CoinsBoost or 0) p:SetAttribute("GemsBoostUntil",d.GemsBoost or 0)
end
local function save(p)
 local d=profiles[p] if not d or not d.Ready or not store or d.Saving then return end d.Saving=true
 local snapshot={XP=d.XP,Next=d.Next,CoinsBoost=d.CoinsBoost,GemsBoost=d.GemsBoost}
 local unlocked=table.clone(d.UnlockedBalls or {})
 local ok=pcall(function() store:UpdateAsync(tostring(p.UserId),function(old) old=type(old)=="table" and old or {} for k,v in pairs(snapshot) do old[k]=math.max(tonumber(old[k]) or 0,v or 0) end old.UnlockedBalls=type(old.UnlockedBalls)=="table" and old.UnlockedBalls or {} for id in pairs(unlocked) do old.UnlockedBalls[id]=true end return old end) end)
 d.Saving=false if not ok then warn("XP/spin save delayed for "..p.UserId) end
end
local function attach(p)
 local d={XP=0,Next=os.time()+600,Ready=not store,CoinsBoost=0,GemsBoost=0,UnlockedBalls={}}
 profiles[p]=d sync(p)
 if store then task.spawn(function()
  local ok,data=pcall(function() return store:GetAsync(tostring(p.UserId)) end)
  if not profiles[p] then return end
  if ok then if type(data)=="table" then d.XP=tonumber(data.XP) or 0 d.Next=tonumber(data.Next) or d.Next d.CoinsBoost=tonumber(data.CoinsBoost) or 0 d.GemsBoost=tonumber(data.GemsBoost) or 0 end d.Ready=true for id,owned in pairs(type(data)=="table" and type(data.UnlockedBalls)=="table" and data.UnlockedBalls or {}) do if owned and RS.HussBallModels:FindFirstChild(id) then d.UnlockedBalls[id]=true p:SetAttribute("OwnedBall_"..id,true) end end sync(p)
  else warn("XP/spin profile unavailable for "..p.UserId) end
 end) end
end
function M.Begin(players)
 match={} started=os.clock()
 for _,p in ipairs(players) do match[p]={Tags=0,Catches=0,Wins=0,Survival=0,Role=p:GetAttribute("PlayerRole"),Alive=true} end
end
function M.Record(p,kind)
 local d=match[p] if not d then return end
 if kind=="Tag" then d.Tags+=1 elseif kind=="Catch" then d.Catches+=1 elseif kind=="Win" then d.Wins=1 end
end
function M.Tagged(p)
 local d=match[p] if d and d.Alive then d.Survival=os.clock()-started d.Alive=false end
end
function M.Finish(winner,cancelled)
 if cancelled then match={} return end
 local rows={} local personal={} local elapsed=os.clock()-started
 for p,d in pairs(match) do if p.Parent==Players then
  if d.Role=="Runner" and d.Alive then d.Survival=elapsed end
  local wins=(winner=="Dodgers" and d.Wins>0) or (winner=="Chasers" and d.Role=="Thrower")
  local survival=d.Role=="Runner" and math.floor(d.Survival/5) or 0
  local gain=survival+d.Catches*10+d.Tags*10+(wins and 25 or 0)
  local profile=profiles[p]
  local before=stat(p,"Level",1).Value
  if profile and profile.Ready then profile.XP+=gain sync(p) end
  table.insert(rows,{UserId=p.UserId,Name=p.DisplayName,XP=gain,Survival=math.floor(d.Survival),Catches=d.Catches})
  personal[p]={Gain=gain,Survival=survival,Catches=d.Catches*10,Tags=d.Tags*10,Win=wins and 25 or 0,Level=stat(p,"Level").Value,BeforeLevel=before,XP=p:GetAttribute("LevelXP") or 0,Required=p:GetAttribute("LevelXPRequired") or 100}
 end end
 for p,own in pairs(personal) do result:FireClient(p,{Winner=winner,Rows=rows,Personal=own,NextMatchAt=workspace:GetServerTimeNow()+16}) end
 match={}
end
local locks={}
spin.OnServerInvoke=function(p,action)
 local d=profiles[p]
 if action=="Info" then return {OK=true,Ready=d and d.Ready,Next=d and d.Next or os.time()+600,Prizes=M.Prizes} end
 if action~="Spin" or not d or not d.Ready then return {OK=false,Message="Your rewards are still loading."} end
 if locks[p] or os.time()<d.Next then return {OK=false,Message="Your next free spin is not ready."} end
 locks[p]=true
 -- Reserve eligibility before granting: duplicate requests cannot pay twice.
 d.Next=os.time()+600 sync(p)
 local roll=Random.new():NextInteger(1,100) local index=1 local sum=0
 for i,prize in ipairs(M.Prizes) do sum+=prize.Weight if roll<=sum then index=i break end end
 local prize=M.Prizes[index] local rewardName=prize.Name
 if prize.Kind=="Coins" then stat(p,"Coins").Value+=prize.Amount
 elseif prize.Kind=="Ball" then
  if p:GetAttribute("OwnedBall_"..prize.Id) then stat(p,"Coins").Value+=500 rewardName="500 Coins · duplicate "..prize.Name else p:SetAttribute("OwnedBall_"..prize.Id,true) end d.UnlockedBalls[prize.Id]=true
 elseif prize.Kind=="CoinsBoost" then d.CoinsBoost=math.max(os.time(),d.CoinsBoost)+prize.Amount
 elseif prize.Kind=="GemsBoost" then d.GemsBoost=math.max(os.time(),d.GemsBoost)+prize.Amount end
 sync(p) task.spawn(save,p) locks[p]=nil
 return {OK=true,Index=index,Name=rewardName,Next=d.Next}
end
Players.PlayerAdded:Connect(attach)
Players.PlayerRemoving:Connect(function(p) save(p) profiles[p]=nil match[p]=nil locks[p]=nil end)
for _,p in ipairs(Players:GetPlayers()) do attach(p) end
task.spawn(function() while task.wait(60) do for p in pairs(profiles) do task.spawn(save,p) end end end)
game:BindToClose(function() for p in pairs(profiles) do task.spawn(save,p) end task.wait(2) end)
return M


