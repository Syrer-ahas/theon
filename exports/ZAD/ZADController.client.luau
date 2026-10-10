local Players = game:GetService("Players")
local TweenService = game:GetService("TweenService")
local UserInputService = game:GetService("UserInputService")
local playerGui = Players.LocalPlayer:WaitForChild("PlayerGui")
local gui = playerGui:WaitForChild("ZAD")
local layout = gui:WaitForChild("Layout")
local basePosition = layout.Position
local panelScale = Instance.new("UIScale")
panelScale.Name = "OpeningScale"
panelScale.Parent = layout
local targetOpen = false
local revision = 0
local internalChange = false
local activeTweens = {}
local states = {}

local function tween(key, object, duration, properties, style)
 if activeTweens[key] then activeTweens[key]:Cancel() end
 local t = TweenService:Create(object, TweenInfo.new(duration, style or Enum.EasingStyle.Quart, Enum.EasingDirection.Out), properties)
 activeTweens[key] = t
 t.Completed:Once(function()
  if activeTweens[key] == t then activeTweens[key] = nil end
 end)
 t:Play()
 return t
end

local function setEnabled(value)
 internalChange = true
 gui.Enabled = value
 internalChange = false
end

local function resetButtons()
 for button, state in pairs(states) do
  state.hovered, state.selected, state.pressed = false, false, false
  state.tilt = 0
  for _, key in ipairs({state.scale, button}) do
   if activeTweens[key] then activeTweens[key]:Cancel(); activeTweens[key] = nil end
  end
  state.scale.Scale = 1
  button.Position = state.position
  button.Rotation = state.rotation
 end
end

local function transition(open)
 if targetOpen == open and (not open or gui.Enabled) then return end
 revision += 1
 local thisRevision = revision
 targetOpen = open
 if open then
  if not gui.Enabled then
   layout.GroupTransparency = 1
   panelScale.Scale = .86
   layout.Position = basePosition + UDim2.fromOffset(0, 48)
   setEnabled(true)
  end
  tween("fade", layout, .12, {GroupTransparency = 0})
  local jump = tween("move", layout, .18, {Position = basePosition + UDim2.fromOffset(0, -14)})
  tween("pop", panelScale, .18, {Scale = 1.045})
  jump.Completed:Once(function(playback)
   if playback ~= Enum.PlaybackState.Completed or revision ~= thisRevision or not targetOpen then return end
   tween("move", layout, .26, {Position = basePosition}, Enum.EasingStyle.Bounce)
   tween("pop", panelScale, .23, {Scale = 1}, Enum.EasingStyle.Quad)
  end)
 else
  resetButtons()
  tween("move", layout, .17, {Position = basePosition + UDim2.fromOffset(0, 12)})
  tween("pop", panelScale, .17, {Scale = .96})
  local fade = tween("fade", layout, .17, {GroupTransparency = 1})
  fade.Completed:Once(function(playback)
   if playback == Enum.PlaybackState.Completed and revision == thisRevision and not targetOpen then
    setEnabled(false)
   end
  end)
 end
end

local function update(button, state)
 local active = state.hovered or state.selected
 local pressed = state.pressed
 local close = button.Name == "CloseButton"
 local duration = pressed and .07 or active and .15 or .2
 tween(state.scale, state.scale, duration, {Scale = pressed and .96 or active and (close and 1.035 or 1.055) or 1})
 tween(button, button, duration, {
  Position = state.position + UDim2.fromOffset(0, active and not pressed and (close and -1 or -3) or 0),
  Rotation = state.rotation + (active and not pressed and not close and state.tilt or 0),
 })
end

for _, button in ipairs(layout:GetChildren()) do
 if button:IsA("GuiButton") then
  local scale = Instance.new("UIScale")
  scale.Name = "ZADHoverScale"
  scale.Parent = button
  local state = {scale = scale, position = button.Position, rotation = button.Rotation, hovered = false, selected = false, pressed = false, tilt = 0}
  states[button] = state
  button.MouseEnter:Connect(function() state.hovered = true; update(button, state) end)
  button.MouseLeave:Connect(function() state.hovered = false; state.tilt = 0; update(button, state) end)
  button.MouseMoved:Connect(function(x)
   if not state.hovered or button.Name == "CloseButton" then return end
   local tilt = math.clamp((x - button.AbsolutePosition.X) / math.max(1, button.AbsoluteSize.X) - .5, -.5, .5) * 1.4
   if math.abs(tilt - state.tilt) > .12 then state.tilt = tilt; update(button, state) end
  end)
  button.SelectionGained:Connect(function() state.selected = true; update(button, state) end)
  button.SelectionLost:Connect(function() state.selected = false; update(button, state) end)
  button.InputBegan:Connect(function(input)
   if input.UserInputType == Enum.UserInputType.MouseButton1 or input.UserInputType == Enum.UserInputType.Touch or input.KeyCode == Enum.KeyCode.ButtonA then
    state.pressed = true
    state.input = input
    update(button, state)
   end
  end)
 end
end

UserInputService.InputEnded:Connect(function(input)
 for button, state in pairs(states) do
  if state.pressed and (input == state.input or input.UserInputType == Enum.UserInputType.MouseButton1 or input.KeyCode == Enum.KeyCode.ButtonA) then
   state.pressed = false
   state.input = nil
   update(button, state)
  end
 end
end)
UserInputService.WindowFocusReleased:Connect(resetButtons)
layout.CloseButton.Activated:Connect(function() transition(false) end)
playerGui:WaitForChild("Build"):WaitForChild("Layout"):WaitForChild("BuildButton").Activated:Connect(function() transition(true) end)
UserInputService.InputBegan:Connect(function(input, processed)
 if processed or UserInputService:GetFocusedTextBox() then return end
 if input.KeyCode == Enum.KeyCode.B then transition(not targetOpen) end
end)
gui:GetPropertyChangedSignal("Enabled"):Connect(function()
 if internalChange then return end
 if gui.Enabled then
  targetOpen = false
  layout.GroupTransparency = 1
  panelScale.Scale = .86
  layout.Position = basePosition + UDim2.fromOffset(0, 48)
  transition(true)
 else
  revision += 1
  targetOpen = false
  for _, key in ipairs({"fade", "move", "pop"}) do
   if activeTweens[key] then activeTweens[key]:Cancel(); activeTweens[key] = nil end
  end
  resetButtons()
 end
end)
layout.GroupTransparency = 1
if gui.Enabled then transition(true) end
