local Players = game:GetService('Players')
local DataStoreService = game:GetService('DataStoreService')
local HttpService = game:GetService('HttpService')
local store = DataStoreService:GetDataStore('BuildInventory_v1')
local StarterCar = require(script.Parent:WaitForChild('StarterCarData'))
local Discovery = require(script.Parent:WaitForChild('ItemDiscovery'))
local Data = {}
local sessions = {}
local LEASE_SECONDS = 180
local closing = false

local function validNumber(value)
 return typeof(value)=='number' and value==value and value>=0 and value<math.huge and value==math.floor(value)
end
local function validate(record)
 if record==nil then return end
 assert(typeof(record)=='table' and record.version==1,'Unsupported inventory save')
 assert(validNumber(record.money) and typeof(record.items)=='table','Invalid inventory save')
 for id,quantity in record.items do
  assert(typeof(id)=='string' and validNumber(quantity),'Invalid inventory quantity')
 end
 if record.discovered~=nil then
  assert(typeof(record.discovered)=='table','Invalid item discovery save')
  for id,found in record.discovered do assert(typeof(id)=='string' and found==true,'Invalid discovered item') end
 end
 if record.builds~=nil then
  assert(typeof(record.builds)=='table' and #record.builds<=500,'Invalid inventory build')
  for _,build in record.builds do
   assert(typeof(build)=='table' and typeof(build.uid)=='string' and typeof(build.id)=='string'
    and typeof(build.pose)=='table' and #build.pose==12,'Invalid inventory build record')
   assert(build.template==nil or typeof(build.template)=='string','Invalid starter template')
   for _,n in build.pose do assert(typeof(n)=='number' and n==n and math.abs(n)<100000,'Invalid inventory build position') end
  end
 end
end
local function key(player)
 return 'player_'..player.UserId
end
local function snapshot(player)
 local items={}
 for _,entry in player.OwnedParts:GetChildren() do
  if entry:IsA('IntValue') and entry.Value>0 then items[entry.Name]=entry.Value end
 end
 local builds={}
 local folder=player:FindFirstChild('StoredBuild')
 if folder then for _,entry in folder:GetChildren() do
  if entry:IsA('CFrameValue') then table.insert(builds,{uid=entry.Name,id=entry:GetAttribute('ItemId'),template=entry:GetAttribute('StarterTemplate'),pose={entry.Value:GetComponents()}}) end
 end end
 return {version=1,money=player.leaderstats.Money.Value,items=items,builds=builds,discovered=Discovery.Snapshot(player),starterCarGranted=player:GetAttribute('StarterCarGranted')==true,savedAt=os.time()}
end

function Data.Save(player,release)
 local session=sessions[player]
 if not session or not session.loaded or session.released then return false end
 if release then session.leaving=true end
 while session.saving do task.wait(.05) end
 if session.released then return true end
 session.saving=true
 local record=snapshot(player)
 local success=false
 local lastError
 for attempt=1,3 do
  local owned=false
  local ok,result=pcall(function()
   return store:UpdateAsync(key(player),function(old)
    owned=false
    validate(old)
    if not old or not old.session or old.session.id~=session.id then return nil end
    owned=true
    local nextRecord=table.clone(record)
    if not release then nextRecord.session={id=session.id,expiresAt=os.time()+LEASE_SECONDS} end
    return nextRecord
   end)
  end)
  if ok and owned and result then success=true;break end
  lastError=ok and 'Save session ownership lost' or tostring(result)
  if ok then
   session.loaded=false
   player:SetAttribute('InventoryDataLoaded',false)
   if player.Parent==Players then player:Kick('Your inventory opened in another server. Please rejoin.') end
   break
  end
  if attempt<3 then task.wait(attempt) end
 end
 session.saving=false
 player:SetAttribute('InventorySaveFailed',not success)
 if success then
  player:SetAttribute('InventoryLastSavedAt',record.savedAt)
  if release then session.released=true end
 else
  warn('Inventory save failed for '..player.UserId..': '..tostring(lastError))
 end
 return success
end

function Data.QueueSave(player)
 local session=sessions[player]
 if not session or not session.loaded or session.leaving or session.queued then return end
 session.queued=true
 task.delay(5,function()
  session.queued=false
  if sessions[player]==session and session.loaded and not session.leaving then Data.Save(player,false) end
 end)
end

local function load(player)
 if sessions[player] or closing then return end
 local session={id=HttpService:GenerateGUID(false),loaded=false,connections={}}
 sessions[player]=session
 player:SetAttribute('InventoryDataLoaded',false)
 local stats=player:FindFirstChild('leaderstats') or Instance.new('Folder')
 stats.Name='leaderstats';stats.Parent=player
 local money=stats:FindFirstChild('Money') or Instance.new('IntValue')
 money.Name='Money';money.Parent=stats
 local inventory=player:FindFirstChild('OwnedParts') or Instance.new('Folder')
 inventory.Name='OwnedParts';inventory.Parent=player
 local buildFolder=player:FindFirstChild('StoredBuild') or Instance.new('Folder')
 buildFolder.Name='StoredBuild';buildFolder.Parent=player
 local record
 local newPlayerRecord = StarterCar.NewRecord(script:GetAttribute('StartingMoney') or 350)
 local lastError
 for attempt=1,6 do
  local acquired=false
  local ok,result=pcall(function()
   return store:UpdateAsync(key(player),function(old)
    acquired=false
    validate(old)
    if old and old.session and old.session.id~=session.id and old.session.expiresAt>os.time() then return nil end
    acquired=true
    local nextRecord=old and table.clone(old) or table.clone(newPlayerRecord)
    nextRecord.session={id=session.id,expiresAt=os.time()+LEASE_SECONDS}
    return nextRecord
   end)
  end)
  if ok and acquired and result then record=result;break end
  lastError=ok and 'Previous server is still saving' or tostring(result)
  if not ok and (string.find(lastError,'Studio access',1,true) or string.find(lastError,'Invalid inventory',1,true)
   or string.find(lastError,'Unsupported inventory',1,true)) then break end
  if attempt<6 then task.wait(3) end
 end
 if not record then
  sessions[player]=nil
  warn('Inventory load failed for '..player.UserId..': '..tostring(lastError))
  if player.Parent==Players then player:Kick('Your inventory could not load safely. Please try joining again.') end
  return
 end
 local catalog={}
 for _,folder in game.ReplicatedStorage:WaitForChild('RollPartTemplates'):GetChildren() do
  for _,item in folder:GetChildren() do local id=item:GetAttribute('RollItemId');if id then catalog[id]=item end end
 end
 inventory:ClearAllChildren()
 buildFolder:ClearAllChildren()
 local discoveries=player:FindFirstChild('DiscoveredItems') or Instance.new('Folder')
 discoveries.Name='DiscoveredItems';discoveries.Parent=player;discoveries:ClearAllChildren()
 for id in Discovery.FromRecord(record) do
  local flag=Instance.new('BoolValue');flag.Name=id;flag.Value=true;flag.Parent=discoveries
 end
 money.Value=record.money
 player:SetAttribute('StarterCarGranted',record.starterCarGranted==true)
 for id,quantity in record.items do
  if quantity>0 then
   local entry=Instance.new('IntValue');entry.Name=id;entry.Value=quantity
   local item=catalog[id]
   if item then
    for _,attribute in {'DisplayName','Rarity','Price','Odds','InventoryImage'} do entry:SetAttribute(attribute,item:GetAttribute(attribute)) end
    entry:SetAttribute('Category',item.Parent.Name)
   end
   entry.Parent=inventory
  end
 end
 for _,build in record.builds or {} do
  local entry=Instance.new('CFrameValue');entry.Name=build.uid;entry.Value=CFrame.new(table.unpack(build.pose))
  entry:SetAttribute('ItemId',build.id);entry:SetAttribute('StarterTemplate',build.template);entry.Parent=buildFolder
 end
 session.loaded=true
 session.stopDiscovery=Discovery.Track(player,inventory,buildFolder,function() Data.QueueSave(player) end)
 player:SetAttribute('InventoryDataLoaded',true)
 local function watch(entry)
  if entry:IsA('IntValue') then table.insert(session.connections,entry.Changed:Connect(function() Data.QueueSave(player) end)) end
 end
 for _,entry in inventory:GetChildren() do watch(entry) end
 table.insert(session.connections,inventory.ChildAdded:Connect(function(entry) watch(entry);Data.QueueSave(player) end))
 table.insert(session.connections,inventory.ChildRemoved:Connect(function() Data.QueueSave(player) end))
 table.insert(session.connections,money.Changed:Connect(function() Data.QueueSave(player) end))
 table.insert(session.connections,buildFolder.ChildAdded:Connect(function() Data.QueueSave(player) end))
 table.insert(session.connections,buildFolder.ChildRemoved:Connect(function() Data.QueueSave(player) end))
 if closing or player.Parent~=Players then
  Data.Save(player,true)
  if session.stopDiscovery then session.stopDiscovery() end
  for _,connection in session.connections do connection:Disconnect() end
  sessions[player]=nil
 end
end

Players.PlayerAdded:Connect(function(player) task.spawn(load,player) end)
Players.PlayerRemoving:Connect(function(player)
 local session=sessions[player]
 if not session then return end
 session.leaving=true
 if session.loaded then
  Data.Save(player,true)
  if session.stopDiscovery then session.stopDiscovery() end
  for _,connection in session.connections do connection:Disconnect() end
  sessions[player]=nil
 end
end)
for _,player in Players:GetPlayers() do task.spawn(load,player) end
task.spawn(function()
 while not closing do
  task.wait(30)
  for player,session in sessions do
   if session.loaded and not session.leaving then task.spawn(Data.Save,player,false) end
  end
 end
end)
game:BindToClose(function()
 closing=true
 local remaining=0
 for player,session in sessions do
  if session.loaded and not session.released then
   remaining+=1
   task.spawn(function() Data.Save(player,true);remaining-=1 end)
  end
 end
 local deadline=os.clock()+25
 while remaining>0 and os.clock()<deadline do task.wait(.05) end
end)
return Data
