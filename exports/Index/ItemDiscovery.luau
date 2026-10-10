local Discovery={}

function Discovery.FromRecord(record)
 local result={}
 for id,found in record.discovered or {} do if found==true then result[id]=true end end
 for id,quantity in record.items or {} do if quantity>0 then result[id]=true end end
 for _,build in record.builds or {} do result[build.id]=true end
 return result
end

function Discovery.Snapshot(player)
 local result={}
 local folder=player:FindFirstChild('DiscoveredItems')
 if folder then for _,entry in folder:GetChildren() do
  if entry:IsA('BoolValue') and entry.Value then result[entry.Name]=true end
 end end
 return result
end

function Discovery.Track(player,inventory,builds,onChanged)
 local folder=player:FindFirstChild('DiscoveredItems') or Instance.new('Folder')
 folder.Name='DiscoveredItems';folder.Parent=player
 local connections,entries={},{}
 local function discover(id)
  if typeof(id)~='string' or id=='' or folder:FindFirstChild(id) then return end
  local flag=Instance.new('BoolValue');flag.Name=id;flag.Value=true;flag.Parent=folder
  onChanged()
 end
 local function watch(entry)
  if not entry:IsA('IntValue') or entries[entry] then return end
  local function changed() if entry.Value>0 then discover(entry.Name) end end
  entries[entry]=entry.Changed:Connect(changed)
  changed()
 end
 local function buildAdded(entry)
  if entry:IsA('CFrameValue') then discover(entry:GetAttribute('ItemId')) end
 end
 connections[1]=inventory.ChildAdded:Connect(watch)
 connections[2]=inventory.ChildRemoved:Connect(function(entry)
  if entries[entry] then entries[entry]:Disconnect();entries[entry]=nil end
 end)
 connections[3]=builds.ChildAdded:Connect(buildAdded)
 for _,entry in inventory:GetChildren() do watch(entry) end
 for _,entry in builds:GetChildren() do buildAdded(entry) end
 return function()
  for _,connection in connections do connection:Disconnect() end
  for _,connection in entries do connection:Disconnect() end
  table.clear(entries)
 end
end

return Discovery
