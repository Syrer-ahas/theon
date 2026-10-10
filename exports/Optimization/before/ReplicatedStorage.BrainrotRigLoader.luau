-- Event-driven rig discovery: streamed meshes/bones may arrive long after tags.
local CollectionService = game:GetService("CollectionService")
local Loader = {}

function Loader.Watch(tag, names, ready, removed, accepts)
 local tracked = {}
 local function release(model, record)
  if record.mesh then
   removed(model)
   record.mesh = nil
   record.joints = nil
  end
 end
 local function refresh(model, record)
  record.queued = false
  if tracked[model] ~= record then return end
  if not model:IsDescendantOf(workspace) or (accepts and not accepts(model)) then
   release(model, record)
   return
  end
  local mesh = model:FindFirstChild(model:GetAttribute("FollowMeshName") or "Mesh", true)
  if not mesh or not mesh:IsA("MeshPart") then release(model, record); return end
  if record.mesh == mesh then return end
  local bones = {}
  for _, name in ipairs(names) do
   local bone = mesh:FindFirstChild(name, true)
   if not bone or not bone:IsA("Bone") then return end
   bones[name] = bone
  end
  local joints = {}
  for name, bone in pairs(bones) do
   joints[name] = {
    bone = bone, rest = bone.Transform,
    side = bone.WorldCFrame:VectorToObjectSpace(mesh.CFrame.RightVector).Unit,
    forward = bone.WorldCFrame:VectorToObjectSpace(mesh.CFrame.LookVector).Unit,
    up = bone.WorldCFrame:VectorToObjectSpace(mesh.CFrame.UpVector).Unit,
   }
  end
  record.mesh, record.joints = mesh, joints
  ready(model, mesh, joints)
 end
 local function queue(model, record)
  if record.queued then return end
  record.queued = true
  task.defer(refresh, model, record)
 end
 local function add(model)
  if tracked[model] or not model:IsA("Model") then return end
  local record = {connections = {}}
  tracked[model] = record
  table.insert(record.connections, model.DescendantAdded:Connect(function(child)
   if child:IsA("Bone") or child:IsA("MeshPart") then queue(model, record) end
  end))
  table.insert(record.connections, model.DescendantRemoving:Connect(function(child)
   if record.mesh and (child == record.mesh or record.mesh:IsDescendantOf(child)
    or (child:IsA("Bone") and record.joints[child.Name] and record.joints[child.Name].bone == child)) then
    release(model, record)
   end
   if child:IsA("Bone") or child:IsA("MeshPart") then queue(model, record) end
  end))
  table.insert(record.connections, model.AncestryChanged:Connect(function() queue(model, record) end))
  for _, attr in ipairs({"FollowMeshName", "AnimationRig"}) do
   table.insert(record.connections, model:GetAttributeChangedSignal(attr):Connect(function()
    release(model, record)
    queue(model, record)
   end))
  end
  queue(model, record)
 end
 local function remove(model)
  local record = tracked[model]
  if not record then return end
  tracked[model] = nil
  release(model, record)
  for _, connection in ipairs(record.connections) do connection:Disconnect() end
 end
 local addedConnection = CollectionService:GetInstanceAddedSignal(tag):Connect(add)
 local removedConnection = CollectionService:GetInstanceRemovedSignal(tag):Connect(remove)
 for _, model in ipairs(CollectionService:GetTagged(tag)) do add(model) end
 return function()
  addedConnection:Disconnect()
  removedConnection:Disconnect()
  local models = {}
  for model in pairs(tracked) do table.insert(models, model) end
  for _, model in ipairs(models) do remove(model) end
 end
end

return Loader
