local ServerStorage = game:GetService("ServerStorage")
local CollectionService = game:GetService("CollectionService")
local area = workspace:WaitForChild("area1")
local templates = ServerStorage:WaitForChild("Area1BrainrotTemplates")
local MAX_ALIVE = 100
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

-- Three circular zones spaced across Area1; sqrt gives uniform disk sampling.
local radius = math.min(area.Size.Z * .35, area.Size.X / 9)
local centers = {Vector2.new(-area.Size.X * .3, 0), Vector2.zero, Vector2.new(area.Size.X * .3, 0)}
folder:SetAttribute("SpawnZoneCount", #centers)
folder:SetAttribute("SpawnZoneRadius", radius)
local function spawnPosition()
 local best, chosen
 for attempt = 1, 32 do
  local zone = random:NextInteger(1, #centers)
  local angle = random:NextNumber(0, math.pi * 2)
  local distance = math.sqrt(random:NextNumber()) * radius
  local center = centers[zone]
  local point = area.CFrame:PointToWorldSpace(Vector3.new(center.X + math.cos(angle) * distance, area.Size.Y / 2, center.Y + math.sin(angle) * distance))
  best, chosen = point, zone
  local clear = true
  for _, other in pairs(slots) do
   local delta = other:GetPivot().Position - point
   if Vector2.new(delta.X, delta.Z).Magnitude < 12 then clear = false; break end
  end
  if clear then break end
 end
 return best, chosen
end

local spawnSlot
spawnSlot = function(slot)
 if slots[slot] or not folder.Parent then return end
 pending[slot] = nil
 local template = templates:FindFirstChild(names[random:NextInteger(1, #names)])
 if not template then error("Missing Area1 brainrot template") end
 local model = template:Clone()
 model:ScaleTo(template:GetScale())
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
 local point, zone = spawnPosition()
 model:SetAttribute("SpawnZone", zone)
 -- Match the follower's mesh-facing axes before measuring the floor clearance.
 local mesh = model:FindFirstChild(model:GetAttribute("FollowMeshName") or "Mesh")
 local meshToPivot = mesh.CFrame:ToObjectSpace(model:GetPivot())
 model:PivotTo(CFrame.new(point) * CFrame.Angles(0, random:NextNumber(0, math.pi * 2), 0) * meshToPivot)
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
