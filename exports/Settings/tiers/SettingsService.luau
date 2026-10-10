local Players = game:GetService('Players')
local Store = game:GetService('DataStoreService'):GetDataStore('PlayerSettings_v1')
local RS = game:GetService('ReplicatedStorage')
local Service = {}
Service.Defaults = {Music=true, SoundEffects=true, ButtonSound=true, ScreenShakes=true, HideCars=false, Performance=false, PerformanceMode=0, InvitePolicy='Everyone'}
local sessions = {}
local function valid(key,value)
 if key=='PerformanceMode' then return typeof(value)=='number' and value%1==0 and value>=0 and value<=2 end
 if key=='InvitePolicy' then return value=='Everyone' or value=='Friends' or value=='Nobody' end
 return Service.Defaults[key]~=nil and typeof(value)=='boolean'
end
local function save(player)
 local s=sessions[player]
 if not s or not s.loaded or not s.dirty or s.saving then return end
 s.saving=true
 local revision=s.revision;local snapshot=table.clone(s.values)
 local ok,err
 for attempt=1,3 do
  ok,err=pcall(function() Store:UpdateAsync('player_'..player.UserId,function() return snapshot end) end)
  if ok then break end
  task.wait(attempt)
 end
 s.saving=false
 if ok and s.revision==revision then s.dirty=false end
 if not ok then warn('Settings save failed: '..tostring(err)) end
end
function Service.CanInvite(sender,recipient)
 local policy=recipient:GetAttribute('Setting_InvitePolicy') or 'Everyone'
 if policy=='Nobody' then return false end
 if policy=='Friends' then local ok,friends=pcall(function() return recipient:IsFriendsWithAsync(sender.UserId) end);return ok and friends end
 return true
end
function Service.Start()
 local remote=RS:FindFirstChild('SettingsUpdate') or Instance.new('RemoteEvent')
 remote.Name='SettingsUpdate';remote.Parent=RS
 local function join(player)
  local s={values=table.clone(Service.Defaults),dirty=false,revision=0,loaded=false,last=0};sessions[player]=s
  for k,v in s.values do player:SetAttribute('Setting_'..k,v) end
  task.spawn(function()
   local ok,data
   for attempt=1,3 do
    ok,data=pcall(function() return Store:GetAsync('player_'..player.UserId) end)
    if ok then break end;task.wait(attempt)
   end
   if sessions[player]~=s or not player.Parent then return end
   if ok then
    if typeof(data)=='table' then for k,v in data do if valid(k,v) then s.values[k]=v end end end
    if typeof(data)=='table' and data.PerformanceMode==nil then s.values.PerformanceMode=data.Performance==true and 2 or 0 end
    s.values.Performance=s.values.PerformanceMode>0
    s.loaded=true
    for k,v in s.values do player:SetAttribute('Setting_'..k,v) end
    player:SetAttribute('SettingsLoaded',true)
   else player:SetAttribute('SettingsLoadFailed',true);warn('Settings load failed; saved preferences will not be overwritten.') end
  end)
 end
 remote.OnServerEvent:Connect(function(player,key,value)
  local s=sessions[player]
  if not s or not s.loaded or typeof(key)~='string' or not valid(key,value) or os.clock()-s.last<.08 then return end
  s.last=os.clock()
  if s.values[key]==value then return end
  if key=='Performance' then key='PerformanceMode';value=value and 2 or 0 end
  s.values[key]=value;s.revision+=1;s.dirty=true
  player:SetAttribute('Setting_'..key,value)
  if key=='PerformanceMode' then s.values.Performance=value>0;player:SetAttribute('Setting_Performance',value>0) end
  if not s.saveQueued then
   s.saveQueued=true
   task.delay(3,function() s.saveQueued=false;if sessions[player]==s then save(player) end end)
  end
 end)
 Players.PlayerAdded:Connect(join)
 for _,p in Players:GetPlayers() do join(p) end
 Players.PlayerRemoving:Connect(function(player)
  local s=sessions[player]
  while s and s.saving do task.wait(.1) end
  save(player);sessions[player]=nil
 end)
 task.spawn(function() while task.wait(15) do for p in sessions do task.spawn(save,p) end end end)
 game:BindToClose(function()
  local pending=0
  for p,s in sessions do pending+=1;task.spawn(function() while s.saving do task.wait(.1) end;save(p);pending-=1 end) end
  local deadline=os.clock()+25;while pending>0 and os.clock()<deadline do task.wait(.1) end
 end)
end
return Service
