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
local SoundService = game:GetService("SoundService")
local ContentProvider = game:GetService("ContentProvider")
local sidePanel = playerGui:WaitForChild("frontend"):WaitForChild("Left_Panel")
local previousPanelVisibility

local sidePanelPosition=sidePanel.Position
local sidePanelTween
local sidePanelRevision=0
local function syncSidePanel(open)
 if open==nil then open=targetOpen end
 sidePanelRevision+=1
 local current=sidePanelRevision
 if sidePanelTween then sidePanelTween:Cancel() end
 if open then
  if previousPanelVisibility==nil then previousPanelVisibility=sidePanel.Visible end
  local off=sidePanelPosition-UDim2.fromOffset(sidePanel.AbsolutePosition.X+sidePanel.AbsoluteSize.X+24,0)
  sidePanelTween=TweenService:Create(sidePanel,TweenInfo.new(.13,Enum.EasingStyle.Quad,Enum.EasingDirection.Out),{Position=off})
  sidePanelTween:Play()
  sidePanelTween.Completed:Once(function(state)
   if current==sidePanelRevision and state==Enum.PlaybackState.Completed then sidePanel.Visible=false end
  end)
 elseif previousPanelVisibility~=nil then
  sidePanel.Visible=previousPanelVisibility
  previousPanelVisibility=nil
  sidePanelTween=TweenService:Create(sidePanel,TweenInfo.new(.13,Enum.EasingStyle.Quad,Enum.EasingDirection.Out),{Position=sidePanelPosition})
  sidePanelTween:Play()
 end
end

local function createSound(name, asset, volume)
 local sound = Instance.new("Sound")
 sound.Name = name
 sound.SoundId = asset
 sound.Volume = volume
 sound.Looped = false
 sound.Parent = SoundService
 return sound
end
local hoverSound = createSound("ZADHoverSound", "rbxassetid://122807358139762", .2)
hoverSound.PlaybackRegionsEnabled = true
hoverSound.PlaybackRegion = NumberRange.new(0, 1)
local clickSound = createSound("ZADClickSound", "rbxassetid://88442833509532", .35)
local hoverGeneration = 0
local function playHover()
 if not gui.Enabled then return end
 hoverGeneration += 1
 local generation = hoverGeneration
 hoverSound:Stop()
 hoverSound.TimePosition = 0
 hoverSound:Play()
 task.delay(1, function()
  if generation == hoverGeneration and hoverSound.Parent then hoverSound:Stop() end
 end)
end
local function playClick()
 if not gui.Enabled then return end
 clickSound:Stop()
 clickSound.TimePosition = 0
 clickSound:Play()
end
task.spawn(function()
 pcall(function() ContentProvider:PreloadAsync({hoverSound, clickSound}) end)
end)

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

local panelMotion
local RunService=game:GetService("RunService")
-- Header positions sampled from the supplied 30 fps recording, divided by its viewport height.
local rise={{0,1},{.0333,282/539},{.10,47/539},{.1333,-35/539},{.20,-50/539},{.2667,-37/539},{.30,-25/539},{.3333,-6/539},{.40,0},{.4333,4/539},{.50,4/539},{.5667,2/539},{.6333,0},{.70,0}}
local drop={{0,0},{.0333,54/539},{.0667,200/539},{.10,394/539},{.15,1.2}}
local function sample(points,t)
 for i=2,#points do
  if t<=points[i][1] then
   local left,right=points[i-1],points[i]
   return left[2]+(right[2]-left[2])*math.clamp((t-left[1])/(right[1]-left[1]),0,1)
  end
 end
 return points[#points][2]
end
local function transition(open)
 if targetOpen==open and (not open or gui.Enabled) then return end
 revision+=1
 local thisRevision=revision
 targetOpen=open
 gui:SetAttribute("BuildMenuOpen",open)
 syncSidePanel(open)
 if panelMotion then panelMotion:Disconnect();panelMotion=nil end
 for _,key in {"fade","move","pop"} do if activeTweens[key] then activeTweens[key]:Cancel();activeTweens[key]=nil end end
 local height=workspace.CurrentCamera.ViewportSize.Y
 local points=open and rise or drop
 local elapsed=0
 panelScale.Scale=1
 layout.GroupTransparency=0
 if open then
  layout.Position=basePosition+UDim2.fromOffset(0,height)
  setEnabled(true)
 else
  resetButtons()
 end
 panelMotion=RunService.RenderStepped:Connect(function(dt)
  if revision~=thisRevision then panelMotion:Disconnect();panelMotion=nil;return end
  elapsed+=dt
  layout.Position=basePosition+UDim2.fromOffset(0,height*sample(points,elapsed))
  if elapsed>=points[#points][1] then
   panelMotion:Disconnect();panelMotion=nil
   if open then layout.Position=basePosition else
    setEnabled(false)
    layout.Position=basePosition
    layout.GroupTransparency=1
   end
  end
 end)
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
  button.MouseEnter:Connect(function() playHover(); state.hovered = true; update(button, state) end)
  button.MouseLeave:Connect(function() state.hovered = false; state.tilt = 0; update(button, state) end)
  button.MouseMoved:Connect(function(x)
   if not state.hovered or button.Name == "CloseButton" then return end
   local tilt = math.clamp((x - button.AbsolutePosition.X) / math.max(1, button.AbsoluteSize.X) - .5, -.5, .5) * 1.4
   if math.abs(tilt - state.tilt) > .12 then state.tilt = tilt; update(button, state) end
  end)
  button.SelectionGained:Connect(function() playHover(); state.selected = true; update(button, state) end)
  button.Activated:Connect(playClick)
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
local buildButtons=playerGui:WaitForChild("Build"):WaitForChild("Layout")
local function syncBuildButtons()
 buildButtons.BuildButton.Visible=not targetOpen
 buildButtons.ReturnButton.Visible=targetOpen
 buildButtons.DeleteButton.Visible=targetOpen
end
buildButtons.BuildButton.Activated:Connect(function() transition(true) end)
buildButtons.ReturnButton.Activated:Connect(function() transition(false) end)
gui:GetAttributeChangedSignal("BuildMenuOpen"):Connect(syncBuildButtons)
syncBuildButtons()
UserInputService.InputBegan:Connect(function(input, processed)
 if processed or UserInputService:GetFocusedTextBox() then return end
 if input.KeyCode == Enum.KeyCode.B then transition(not targetOpen) end
end)
gui:GetPropertyChangedSignal("Enabled"):Connect(function()
 if internalChange then return end
 if gui.Enabled then
  targetOpen = false
  layout.GroupTransparency = 1
  panelScale.Scale = .78
  layout.Position = basePosition + UDim2.fromOffset(0, workspace.CurrentCamera.ViewportSize.Y)
  transition(true)
 else
  revision += 1
  targetOpen = false
  gui:SetAttribute("BuildMenuOpen",false)
  for _, key in ipairs({"fade", "move", "pop"}) do
   if activeTweens[key] then activeTweens[key]:Cancel(); activeTweens[key] = nil end
  end
  resetButtons()
 end
end)
layout.GroupTransparency = 1
if gui.Enabled then transition(true) end


syncSidePanel()
script.Destroying:Connect(function()
 if previousPanelVisibility ~= nil and sidePanel.Parent then sidePanel.Visible = previousPanelVisibility end
 hoverSound:Destroy()
 clickSound:Destroy()
end)
