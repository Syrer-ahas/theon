local Players = game:GetService("Players")
local CollectionService = game:GetService("CollectionService")
local TweenService = game:GetService("TweenService")
local RunService = game:GetService("RunService")
local player = Players.LocalPlayer
local gui = player:WaitForChild("PlayerGui"):WaitForChild("ExclusiveShop")
local OPEN_DISTANCE = 4
local REARM_DISTANCE = 9
local shops = {}
local objects = {}
local center = gui:WaitForChild("Panel").Position
local motion = Instance.new("Vector3Value")
motion.Value = Vector3.new(1, 0, 0)
local animation
local generation = 0

for _, object in ipairs(gui:GetChildren()) do
 if object:IsA("GuiObject") then
  local scale = Instance.new("UIScale")
  scale.Name = "ShopOpeningScale"
  scale.Parent = object
  objects[object] = {position = object.Position, scale = scale}
 end
end

local function applyMotion()
 local scale, jump = motion.Value.X, motion.Value.Y
 for object, data in pairs(objects) do
  if object.Parent then
   local p = data.position
   object.Position = UDim2.new(
    center.X.Scale + (p.X.Scale - center.X.Scale) * scale,
    center.X.Offset + (p.X.Offset - center.X.Offset) * scale,
    center.Y.Scale + (p.Y.Scale - center.Y.Scale) * scale,
    center.Y.Offset + (p.Y.Offset - center.Y.Offset) * scale + jump)
   data.scale.Scale = scale
  end
 end
end
motion.Changed:Connect(applyMotion)

local function openAnimation()
 generation += 1
 local current = generation
 if animation then animation:Cancel() end
 motion.Value = Vector3.new(.78, 78, 0)
 animation = TweenService:Create(motion, TweenInfo.new(.17, Enum.EasingStyle.Quart, Enum.EasingDirection.Out), {Value = Vector3.new(1.085, -32, 0)})
 animation.Completed:Once(function(state)
  if state ~= Enum.PlaybackState.Completed or current ~= generation or not gui.Enabled then return end
  animation = TweenService:Create(motion, TweenInfo.new(.36, Enum.EasingStyle.Bounce, Enum.EasingDirection.Out), {Value = Vector3.new(1, 0, 0)})
  animation:Play()
 end)
 animation:Play()
end

gui:GetPropertyChangedSignal("Enabled"):Connect(function()
 if gui.Enabled then openAnimation()
 else
  generation += 1
  if animation then animation:Cancel() end
  motion.Value = Vector3.new(1, 0, 0)
 end
end)
if gui.Enabled then openAnimation() end

local function add(model)
 if model:IsA("Model") then shops[model] = {armed = true} end
end
CollectionService:GetInstanceAddedSignal("ExclusiveShopTrigger"):Connect(add)
CollectionService:GetInstanceRemovedSignal("ExclusiveShopTrigger"):Connect(function(model) shops[model] = nil end)
for _, model in ipairs(CollectionService:GetTagged("ExclusiveShopTrigger")) do add(model) end

local function distanceToShop(model, position)
 local cf, size = model:GetBoundingBox()
 local p = cf:PointToObjectSpace(position)
 local half = size / 2
 local delta = Vector3.new(math.max(0, math.abs(p.X) - half.X), math.max(0, math.abs(p.Y) - half.Y), math.max(0, math.abs(p.Z) - half.Z))
 return delta.Magnitude
end

local elapsed = 0
RunService.Heartbeat:Connect(function(dt)
 elapsed += dt
 if elapsed < .15 then return end
 elapsed = 0
 local character = player.Character
 local root = character and character:FindFirstChild("HumanoidRootPart")
 local humanoid = character and character:FindFirstChildOfClass("Humanoid")
 if not root or not humanoid or humanoid.Health <= 0 then return end
 for model, record in pairs(shops) do
  if model:IsDescendantOf(workspace) and model:FindFirstChildWhichIsA("BasePart", true) then
   local distance = distanceToShop(model, root.Position)
   if distance > REARM_DISTANCE then record.armed = true
   elseif distance <= OPEN_DISTANCE and record.armed then
    record.armed = false
    gui.Enabled = true
   end
  end
 end
end)

script.Destroying:Connect(function()
 generation += 1
 if animation then animation:Cancel() end
 motion.Value = Vector3.new(1, 0, 0)
 motion:Destroy()
 for _, data in pairs(objects) do data.scale:Destroy() end
end)
