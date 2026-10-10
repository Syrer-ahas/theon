local Players=game:GetService('Players')
local ReplicatedStorage=game:GetService('ReplicatedStorage')
local HttpService=game:GetService('HttpService')
local Geometry=require(ReplicatedStorage:WaitForChild('BuildGeometry'))
local Ownership=require(ReplicatedStorage:WaitForChild('PlotOwnership'))
local Data=require(script.Parent:WaitForChild('PlayerInventoryData'))
local remote=ReplicatedStorage:FindFirstChild('PlotBuildRequest') or Instance.new('RemoteFunction')
remote.Name='PlotBuildRequest';remote.Parent=ReplicatedStorage
local catalog=Geometry.Catalog()
local lastRequest={}
local function plotFor(player)
 local ref=player:FindFirstChild('AssignedPlot');local plot=ref and ref.Value
 if plot and Ownership.CanUse(player,plot) then return plot end
end
local function placedFolder(plot)
 local folder=plot:FindFirstChild('PlacedBuild') or Instance.new('Folder')
 folder.Name='PlacedBuild';folder.Parent=plot;return folder
end
local function records(player)
 return player:FindFirstChild('StoredBuild')
end
local function entryFor(player,id)
 local f=player:FindFirstChild('OwnedParts');return f and f:FindFirstChild(id)
end
local function refund(player,id)
 local entry=entryFor(player,id)
 if not entry then
  local item=catalog[id];if not item then return end
  entry=Instance.new('IntValue');entry.Name=id
  for _,a in {'DisplayName','Rarity','Price','Odds','InventoryImage'} do entry:SetAttribute(a,item:GetAttribute(a)) end
  entry:SetAttribute('Category',item.Parent.Name);entry.Parent=player.OwnedParts
 end
 entry.Value+=1
end
local function restore(player)
 if not player:GetAttribute('InventoryDataLoaded') then return end
 local plot=plotFor(player);local surface=Geometry.Surface(plot);local saved=records(player)
 if not plot or not surface or not saved then return end
 local folder=placedFolder(plot)
 for _,record in saved:GetChildren() do
  local template=catalog[record:GetAttribute('ItemId')]
  local starterName=record:GetAttribute('StarterTemplate')
  local starterFolder=ReplicatedStorage:FindFirstChild('StarterBuildTemplates')
  local starterTemplate=starterName and starterFolder and starterFolder:FindFirstChild(starterName)
  if starterTemplate and starterTemplate:GetAttribute('BuildItemId')==record:GetAttribute('ItemId') then template=starterTemplate end
  if template and not folder:FindFirstChild(record.Name) then
   local model=Geometry.Clone(template)
   model.Name=record.Name;model:SetAttribute('BuildItemId',record:GetAttribute('ItemId'));model:SetAttribute('OwnerUserId',player.UserId)
   model:PivotTo(surface.CFrame*record.Value);model.Parent=folder
  end
 end
 -- Re-seat saved upright engines from the earlier contact offsets.
 local adjusted=false
 for _,model in folder:GetChildren() do
  local template=catalog[model:GetAttribute('BuildItemId')]
  local inset=template and template:GetAttribute('BuildContactInset')
  local pivot=model:GetPivot()
  if inset and pivot.UpVector:Dot(surface.CFrame.UpVector)>.999 then
   local include={surface}
   for _,other in folder:GetChildren() do if other~=model then table.insert(include,other) end end
   local ray=RaycastParams.new();ray.FilterType=Enum.RaycastFilterType.Include;ray.FilterDescendantsInstances=include
   local contact=pivot.Position+surface.CFrame.UpVector*inset
   local hit=workspace:Raycast(contact+surface.CFrame.UpVector*.8,-surface.CFrame.UpVector*1.6,ray)
   if hit and hit.Normal:Dot(surface.CFrame.UpVector)>.9 then
    local delta=(hit.Position-contact):Dot(surface.CFrame.UpVector)
    if math.abs(delta)>.005 and math.abs(delta)<.75 then
     local corrected=pivot+surface.CFrame.UpVector*delta
     model:PivotTo(corrected)
     local record=saved:FindFirstChild(model.Name)
     if record then record.Value=surface.CFrame:ToObjectSpace(corrected);adjusted=true end
    end
   end
  end
 end
 if adjusted then Data.QueueSave(player) end
end
local function watch(player)
 player:GetAttributeChangedSignal('InventoryDataLoaded'):Connect(function() restore(player) end)
 player:GetAttributeChangedSignal('PlotName'):Connect(function() task.defer(restore,player) end)
 restore(player)
end
Players.PlayerAdded:Connect(watch)
for _,p in Players:GetPlayers() do watch(p) end
Players.PlayerRemoving:Connect(function(player)
 lastRequest[player]=nil
 for _,plot in workspace:GetDescendants() do
  if plot.Name:match('^Plot%d+$') then
   local folder=plot:FindFirstChild('PlacedBuild')
   if folder then for _,m in folder:GetChildren() do if m:GetAttribute('OwnerUserId')==player.UserId then m:Destroy() end end end
  end
 end
end)
local function finite(n) return typeof(n)=='number' and n==n and math.abs(n)<100000 end
remote.OnServerInvoke=function(player,action,payload)
 if player:GetAttribute('IsDriving')==true then return false,'Exit driving before editing your car' end
 if player:GetAttribute('InventoryDataLoaded')~=true then return false,'Inventory is loading' end
 local now=os.clock();if now-(lastRequest[player] or -1)<.12 then return false,'Please wait a moment' end;lastRequest[player]=now
 local plot=plotFor(player);local surface=Geometry.Surface(plot)
 if not surface then return false,'Your plot has no SpawnOn surface' end
 local root=player.Character and player.Character:FindFirstChild('HumanoidRootPart')
 local humanoid=player.Character and player.Character:FindFirstChildOfClass('Humanoid')
 if not root or not humanoid or humanoid.Health<=0 or (root.Position-surface.Position).Magnitude>110 then return false,'Move closer to your plot' end
 local folder=placedFolder(plot);local saved=records(player)
 if not saved then return false,'Build data is loading' end
 if action=='Remove' then
  if typeof(payload)~='string' then return false,'Invalid item' end
  local model=folder:FindFirstChild(payload);local record=saved:FindFirstChild(payload)
  if not model or not record or model:GetAttribute('OwnerUserId')~=player.UserId then return false,'You can only remove your own items' end
  refund(player,record:GetAttribute('ItemId'));model:Destroy();record:Destroy();Data.QueueSave(player);return true,'Item returned to inventory'
 elseif action=='Clear' then
  for _,record in saved:GetChildren() do refund(player,record:GetAttribute('ItemId'));record:Destroy() end
  folder:ClearAllChildren();Data.QueueSave(player);return true,'Plot cleared; items returned'
 elseif action~='Place' or typeof(payload)~='table' then return false,'Invalid request' end
 local id=payload.id;local x,y,z,turn=payload.x,payload.y,payload.z,payload.turn
 local tilt=payload.tilt or 0
 if typeof(id)~='string' or not finite(x) or not finite(y) or not finite(z) or not finite(turn) then return false,'Invalid placement' end
 if turn~=math.floor(turn) or turn<0 or turn>3 or not finite(tilt) or tilt~=math.floor(tilt) or tilt<0 or tilt>3 then return false,'Invalid rotation' end
 x=math.round(x/Geometry.Grid)*Geometry.Grid;z=math.round(z/Geometry.Grid)*Geometry.Grid
 if #saved:GetChildren()>=Geometry.MaxParts then return false,'Plot is full' end
 local template=catalog[id];local entry=entryFor(player,id)
 if not template or not entry or not entry:IsA('IntValue') or entry.Value<1 then return false,'You do not own this item' end
 local model,size,lift,contactInset=Geometry.Clone(template)
 local engineSupport
 if payload.stackOn~=nil then
  if typeof(payload.stackOn)~='string' or not id:match('^Engines:') or tilt~=0 or payload.mountPoint~=nil then model:Destroy();return false,'Invalid engine stack' end
  engineSupport=folder:FindFirstChild(payload.stackOn)
  if not engineSupport or not engineSupport:IsA('Model') or engineSupport:GetAttribute('OwnerUserId')~=player.UserId then model:Destroy();return false,'Stack on your own engine' end
  local stackHeight=Geometry.EngineStackHeight(surface,engineSupport,x,z)
  if not stackHeight then model:Destroy();return false,'Place above the engine' end
  y=stackHeight
 end
 if not payload.mountPoint and not Geometry.Fits(surface,size,x,y,z,turn,tilt,lift,contactInset) then model:Destroy();return false,'Keep the whole item inside SpawnOn' end
 local pose=Geometry.Pose(surface,x,y,z,turn,tilt,size,lift,contactInset)
 local box,checkSize=Geometry.PlacementBox(surface,x,y,z,turn,tilt,size,lift,contactInset)
 if payload.mountPoint~=nil then
  local point,normal=payload.mountPoint,payload.mountNormal
  if not id:match('^tires:') or typeof(point)~='Vector3' or typeof(normal)~='Vector3'
   or not finite(point.X) or not finite(point.Y) or not finite(point.Z)
   or not finite(normal.X) or not finite(normal.Y) or not finite(normal.Z) then model:Destroy();return false,'Invalid tire mount' end
  local fits
  pose,box,checkSize,fits,point=Geometry.WheelMount(surface,model,size,point,normal)
  if not pose or not fits then model:Destroy();return false,'Keep the tire inside SpawnOn' end
  local worldNormal=surface.CFrame:VectorToWorldSpace(normal.Unit)
  local contact=surface.CFrame:PointToWorldSpace(point)
  local ray=RaycastParams.new();ray.FilterType=Enum.RaycastFilterType.Include;ray.FilterDescendantsInstances={folder};ray.RespectCanCollide=true
  local hit=workspace:Raycast(contact+worldNormal*.08,-worldNormal*.16,ray)
  if not hit or hit.Normal:Dot(worldNormal)<.98 or (hit.Position-contact).Magnitude>.02 then model:Destroy();return false,'Attach the tire bracket to a block side' end
  local support=hit.Instance
  while support and support.Parent~=folder do support=support.Parent end
  if not support or support:GetAttribute('OwnerUserId')~=player.UserId or tostring(support:GetAttribute('BuildItemId')):match('^tires:') then
   model:Destroy();return false,'Attach to your car body' end
 end
 local query=OverlapParams.new();query.FilterType=Enum.RaycastFilterType.Include;query.FilterDescendantsInstances={folder};query.RespectCanCollide=true
 if #workspace:GetPartBoundsInBox(box,Vector3.new(math.max(.01,checkSize.X-.04),math.max(.01,checkSize.Y-.04),math.max(.01,checkSize.Z-.04)),query)>0 then
  model:Destroy();return false,'That space is occupied'
 end
 if not payload.mountPoint and not engineSupport and y>.001 then
  local ray=RaycastParams.new();ray.FilterType=Enum.RaycastFilterType.Include;ray.FilterDescendantsInstances={folder,surface}
  local hit=workspace:Raycast(surface.CFrame:PointToWorldSpace(Vector3.new(x,surface.Size.Y/2+y+.05,z)),-surface.CFrame.UpVector*.18,ray)
  if not hit then model:Destroy();return false,'Place on the surface or an existing part' end
 end
 local uid=HttpService:GenerateGUID(false)
 local record=Instance.new('CFrameValue');record.Name=uid;record.Value=surface.CFrame:ToObjectSpace(pose);record:SetAttribute('ItemId',id)
 model.Name=uid;model:SetAttribute('BuildItemId',id);model:SetAttribute('OwnerUserId',player.UserId);model:PivotTo(pose)
 -- No yields while inventory is consumed and the build record is created.
 entry.Value-=1;record.Parent=saved;model.Parent=folder;Data.QueueSave(player)
 return true,'Placed '..(template:GetAttribute('DisplayName') or template.Name)
end

