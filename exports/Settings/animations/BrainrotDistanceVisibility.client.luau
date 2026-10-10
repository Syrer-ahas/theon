local Players = game:GetService("Players")
local CollectionService = game:GetService("CollectionService")
local RunService = game:GetService("RunService")
local player = Players.LocalPlayer
local MAX_DISTANCE = 200
local performanceMode=player:GetAttribute("Setting_Performance")==true
local function currentDistance(model)
 if not performanceMode then return MAX_DISTANCE end
 -- Active threats remain readable while idle distant crowds cost less to draw.
 local state=model:GetAttribute("PatapimState")
 local level=player:GetAttribute("Setting_PerformanceMode") or 2
 return (state=="Punch" or state=="Chase") and 170 or (level==1 and 170 or 120)
end
local tracked = {}

local function apply(object, hidden, originals)
 if object:IsA("BasePart") then
  if hidden then
   if originals[object] == nil then originals[object] = object.LocalTransparencyModifier end
   object.LocalTransparencyModifier = 1
  elseif originals[object] ~= nil then
   object.LocalTransparencyModifier = originals[object]
   originals[object] = nil
  end
 elseif object:IsA("BillboardGui") or object:IsA("SurfaceGui") or object:IsA("Highlight")
  or object:IsA("ParticleEmitter") or object:IsA("Beam") or object:IsA("Trail") then
  if hidden then
   if originals[object] == nil then originals[object] = object.Enabled end
   object.Enabled = false
  elseif originals[object] ~= nil then
   object.Enabled = originals[object]
   originals[object] = nil
  end
 end
end

local function setHidden(model, record, hidden)
 if record.hidden == hidden then return end
 record.hidden = hidden
 model:SetAttribute("BrainrotDistanceHidden", hidden)
 for _, object in ipairs(model:GetDescendants()) do apply(object, hidden, record.originals) end
end

local function referencePosition()
 local root = player.Character and player.Character:FindFirstChild("HumanoidRootPart")
 return root and root.Position or (workspace.CurrentCamera and workspace.CurrentCamera.CFrame.Position)
end

local function check(model, record, position)
 if not position or not model:IsDescendantOf(workspace) then setHidden(model, record, true); return end
 local offset = model:GetPivot().Position - position
 setHidden(model, record, offset:Dot(offset) > (currentDistance(model)+(performanceMode and record.hidden==false and 8 or 0))^2)
end

local function add(model)
 if not model:IsA("Model") or tracked[model] then return end
 local record = {originals = {}, hidden = nil}
 tracked[model] = record
 record.connection = model.DescendantAdded:Connect(function(object)
  if record.hidden then apply(object, true, record.originals) end
 end)
 record.removingConnection=model.DescendantRemoving:Connect(function(object) record.originals[object]=nil end)
 check(model, record, referencePosition())
end

local function remove(model)
 local record = tracked[model]
 if not record then return end
 setHidden(model, record, false)
 record.connection:Disconnect()
 record.removingConnection:Disconnect()
 tracked[model] = nil
end

CollectionService:GetInstanceAddedSignal("Brainrot"):Connect(add)
CollectionService:GetInstanceRemovedSignal("Brainrot"):Connect(remove)
for _, model in ipairs(CollectionService:GetTagged("Brainrot")) do add(model) end
local elapsed = 0
local function refreshPerformance()
 performanceMode=player:GetAttribute("Setting_Performance")==true
 local position=referencePosition()
 for model,record in pairs(tracked) do check(model,record,position) end
end
player:GetAttributeChangedSignal("Setting_Performance"):Connect(refreshPerformance)
player:GetAttributeChangedSignal("Setting_PerformanceMode"):Connect(refreshPerformance)
RunService.Heartbeat:Connect(function(dt)
 elapsed += dt
 if elapsed < .15 then return end
 elapsed = 0
 local position = referencePosition()
 for model, record in pairs(tracked) do check(model, record, position) end
end)
script.Destroying:Connect(function()
 local models = {}
 for model in pairs(tracked) do table.insert(models, model) end
 for _, model in ipairs(models) do remove(model) end
end)
