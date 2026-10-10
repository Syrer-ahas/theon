local ServerStorage = game:GetService("ServerStorage")
local CollectionService = game:GetService("CollectionService")
local area = workspace:WaitForChild("area1")
local templates = ServerStorage:WaitForChild("Area1BrainrotTemplates")
local MAX_ALIVE = 40
local RESPAWN_SECONDS = 10
local names = {"Brr Brr Patapim", "Cacto Hipopotamo", "Girafa Celeste"}
local random = Random.new()
local folder = Instance.new("Folder")
folder.Name = "Area1Brainrots"
folder:SetAttribute("MaxAlive", MAX_ALIVE)
folder:SetAttribute("RespawnSeconds", RESPAWN_SECONDS)
folder.Parent = workspace
local slots = {}
local pending = {}
local alive = 0

local function countChanged()
 folder:SetAttribute("AliveCount", alive)
end

local function spawnPosition()
 local halfX = math.max(0, area.Size.X / 2 - 12)
 local halfZ = math.max(0, area.Size.Z / 2 - 12)
 local best
 for attempt = 1, 24 do
  local point = area.CFrame:PointToWorldSpace(Vector3.new(random:NextNumber(-halfX, halfX), area.Size.Y / 2, random:NextNumber(-halfZ, halfZ)))
  best = point
  local clear = true
  for _, other in pairs(slots) do
   local delta = other:GetPivot().Position - point
   if Vector2.new(delta.X, delta.Z).Magnitude < 12 then clear = false; break end
  end
  if clear then break end
 end
 return best
end

local spawnSlot
spawnSlot = function(slot)
 if slots[slot] or not folder.Parent then return end
 pending[slot] = nil
 local template = templates:FindFirstChild(names[random:NextInteger(1, #names)])
 if not template then error("Missing Area1 brainrot template") end
 local model = template:Clone()
 model:SetAttribute("Area1Spawn", true)
 model:SetAttribute("SpawnSlot", slot)
 model:SetAttribute("PatapimState", "Idle")
 model:SetAttribute("TargetUserId", 0)
 model:SetAttribute("PunchStartedAt", nil)
 model.ModelStreamingMode = Enum.ModelStreamingMode.Atomic
 for _, object in ipairs(model:GetDescendants()) do
  if object:IsA("BasePart") then object.Anchored = true end
  if object:IsA("Bone") then object.Transform = CFrame.identity end
 end
 local point = spawnPosition()
 local rotation = CFrame.Angles(0, random:NextNumber(0, math.pi * 2), 0) * model:GetPivot().Rotation
 model:PivotTo(CFrame.new(point) * rotation)
 local box, size = model:GetBoundingBox()
 local correction = point.Y - (box.Position.Y - size.Y / 2) + .05
 model:PivotTo(model:GetPivot() + Vector3.new(0, correction, 0))
 local humanoid = model:FindFirstChildOfClass("Humanoid") or Instance.new("Humanoid")
 humanoid.Name = "Humanoid"
 humanoid.RequiresNeck = false
 humanoid.BreakJointsOnDeath = false
 humanoid.AutoRotate = false
 humanoid.DisplayDistanceType = Enum.HumanoidDisplayDistanceType.None
 humanoid.MaxHealth = 100
 humanoid.Health = 100
 humanoid.Parent = model
 slots[slot] = model
 alive += 1
 countChanged()
 local ended = false
 local connections = {}
 local function retire()
  if ended or slots[slot] ~= model then return end
  ended = true
  slots[slot] = nil
  alive -= 1
  countChanged()
  for _, connection in ipairs(connections) do connection:Disconnect() end
  pending[slot] = true
  task.defer(function() if model.Parent then model:Destroy() end end)
  task.delay(RESPAWN_SECONDS, function()
   if pending[slot] and folder.Parent then spawnSlot(slot) end
  end)
 end
 table.insert(connections, humanoid.Died:Connect(retire))
 table.insert(connections, humanoid.HealthChanged:Connect(function(health) if health <= 0 then retire() end end))
 table.insert(connections, model.Destroying:Connect(retire))
 table.insert(connections, model.AncestryChanged:Connect(function()
  if not model:IsDescendantOf(folder) then retire() end
 end))
 CollectionService:AddTag(model, "Brainrot")
 CollectionService:AddTag(model, "FastWalkingPatapim")
 model.Parent = folder
end

countChanged()
for slot = 1, MAX_ALIVE do spawnSlot(slot) end
