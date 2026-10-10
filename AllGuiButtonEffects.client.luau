local TweenService = game:GetService("TweenService")
local UserInputService = game:GetService("UserInputService")

-- Place ONE copy in StarterPlayer > StarterPlayerScripts.
local Players = game:GetService("Players")
local gui = Players.LocalPlayer:WaitForChild("PlayerGui")

-- Frontend and Index buttons share one local sound so quick hovers do not pile up.
local SoundService = game:GetService("SoundService")
local ContentProvider = game:GetService("ContentProvider")
local frontendHoverSound = Instance.new("Sound")
frontendHoverSound.Name = "FrontendHoverSound"
frontendHoverSound.SoundId = "rbxassetid://122807358139762"
frontendHoverSound.Volume = 0.5
frontendHoverSound.Looped = false
frontendHoverSound.PlaybackRegionsEnabled = true
frontendHoverSound.PlaybackRegion = NumberRange.new(0, 1)
frontendHoverSound.Parent = SoundService

task.spawn(function()
	pcall(function()
		ContentProvider:PreloadAsync({frontendHoverSound})
	end)
end)

local function playButtonHover(button)
	local screenGui = button:FindFirstAncestorWhichIsA("ScreenGui")
	if not screenGui then return end
	local name = screenGui.Name:lower()
	if name ~= "frontend" and name ~= "index" then return end
	frontendHoverSound:Stop()
	frontendHoverSound.TimePosition = 0
	frontendHoverSound:Play()
end

local HOVER_SCALE = 1.10
local PRESS_SCALE = 0.94

local ICON_ROTATION = -7
local ICON_HOVER_SCALE = 1.045
local ICON_LIFT = 2

local HOVER = TweenInfo.new(0.22, Enum.EasingStyle.Back, Enum.EasingDirection.Out)
local LEAVE = TweenInfo.new(0.18, Enum.EasingStyle.Quint, Enum.EasingDirection.Out)
local PRESS = TweenInfo.new(0.07, Enum.EasingStyle.Quad, Enum.EasingDirection.Out)

local states = {}
local currentTweens = {}

local function tween(object, info, properties)
	if currentTweens[object] then
		currentTweens[object]:Cancel()
	end

	local animation = TweenService:Create(object, info, properties)
	currentTweens[object] = animation

	animation.Completed:Once(function()
		if currentTweens[object] == animation then
			currentTweens[object] = nil
		end
	end)

	animation:Play()
end

local function getScale(object)
	local scale = object:FindFirstChildOfClass("UIScale")

	if not scale then
		scale = Instance.new("UIScale")
		scale.Name = "ButtonEffectScale"
		scale.Parent = object
	end

	return scale
end

local function findIcon(button)
	local bestIcon
	local largestArea = -1

	for _, object in ipairs(button:GetDescendants()) do
		if object:IsA("ImageLabel") and object:FindFirstAncestorWhichIsA("GuiButton") == button then
			-- Set HoverIcon = true on an ImageLabel to select it explicitly.
			if object:GetAttribute("HoverIcon") == true then
				return object
			end

			if object.Visible and object.Image ~= "" then
				local area = object.AbsoluteSize.X * object.AbsoluteSize.Y

				if area > largestArea then
					largestArea = area
					bestIcon = object
				end
			end
		end
	end

	return bestIcon
end

local function update(state)
	local active = state.hovered or state.selected or state.touching
	local pressed = state.pressed and active

	local info = pressed and PRESS or (active and HOVER or LEAVE)
	local targetScale = pressed and PRESS_SCALE or (active and HOVER_SCALE or 1)

	tween(state.scale, info, {
		Scale = state.baseScale * targetScale,
	})

	if not state.icon then
		return
	end

	local animateIcon = active and not pressed
	local position = state.iconPosition

	-- The button itself never rotates.
	tween(state.icon, info, {
		Rotation = state.iconRotation + (animateIcon and ICON_ROTATION or 0),
		Position = UDim2.new(
			position.X.Scale,
			position.X.Offset,
			position.Y.Scale,
			position.Y.Offset - (animateIcon and ICON_LIFT or 0)
		),
	})

	tween(state.iconScale, info, {
		Scale = state.baseIconScale * (animateIcon and ICON_HOVER_SCALE or 1),
	})
end

local function stopTween(object)
	if object and currentTweens[object] then
		currentTweens[object]:Cancel()
		currentTweens[object] = nil
	end
end

local function restoreIcon(state)
	if state.icon then
		stopTween(state.icon)
		stopTween(state.iconScale)
		state.icon.Rotation = state.iconRotation
		state.icon.Position = state.iconPosition
		state.iconScale.Scale = state.baseIconScale
		state.icon = nil
		state.iconScale = nil
	end
end

local function refreshIcon(button, state)
	if states[button] ~= state then return end
	local icon = findIcon(button)
	if icon == state.icon then return end
	restoreIcon(state)
	if icon then
		state.icon = icon
		state.iconScale = getScale(icon)
		state.baseIconScale = state.iconScale.Scale
		state.iconRotation = icon.Rotation
		state.iconPosition = icon.Position
	end
	update(state)
end

local function reset(state)
	state.hovered = false
	state.selected = false
	state.touching = false
	state.pressed = false
	state.pressInput = nil
	stopTween(state.scale)
	state.scale.Scale = state.baseScale
	if state.icon then
		stopTween(state.icon)
		stopTween(state.iconScale)
		state.icon.Rotation = state.iconRotation
		state.icon.Position = state.iconPosition
		state.iconScale.Scale = state.baseIconScale
	end
end

local function cleanupButton(button)
	local state = states[button]
	if not state then return end
	states[button] = nil
	for _, connection in ipairs(state.connections) do
		connection:Disconnect()
	end
	for _, connection in ipairs(state.visibilityConnections) do
		connection:Disconnect()
	end
	reset(state)
end

local function watchVisibility(button, state)
	for _, connection in ipairs(state.visibilityConnections) do
		connection:Disconnect()
	end
	table.clear(state.visibilityConnections)
	local ancestor = button
	while ancestor and ancestor ~= gui do
		local property
		if ancestor:IsA("GuiObject") then
			property = "Visible"
		elseif ancestor:IsA("LayerCollector") then
			property = "Enabled"
		end
		if property then
			local watched = ancestor
			table.insert(state.visibilityConnections,
				watched:GetPropertyChangedSignal(property):Connect(function()
					if not watched[property] then reset(state) end
				end))
			if not watched[property] then reset(state) end
		end
		ancestor = ancestor.Parent
	end
end

local function setupButton(button)
	if states[button] or not button:IsDescendantOf(gui) then
		return
	end

	local scale = getScale(button)
	local icon = findIcon(button)

	local state = {
		scale = scale,
		baseScale = scale.Scale,
		icon = icon,
		hovered = false,
		selected = false,
		touching = false,
		pressed = false,
		connections = {},
		visibilityConnections = {},
	}

	if icon then
		state.iconScale = getScale(icon)
		state.baseIconScale = state.iconScale.Scale
		state.iconRotation = icon.Rotation
		state.iconPosition = icon.Position
	end

	states[button] = state
	local function connect(signal, callback)
		table.insert(state.connections, signal:Connect(callback))
	end

	connect(button.MouseEnter, function()
		playButtonHover(button)
		state.hovered = true
		update(state)
	end)

	connect(button.MouseLeave, function()
		state.hovered = false
		update(state)
	end)

	connect(button.SelectionGained, function()
		state.selected = true
		update(state)
	end)

	connect(button.SelectionLost, function()
		state.selected = false
		update(state)
	end)

	connect(button.InputBegan, function(input)
		local isMouse = input.UserInputType == Enum.UserInputType.MouseButton1
		local isTouch = input.UserInputType == Enum.UserInputType.Touch

		if isMouse or isTouch then
			state.pressed = true
			state.touching = isTouch
			state.pressInput = input
			update(state)
		end
	end)

	connect(button.DescendantAdded, function(object)
		if object:IsA("ImageLabel") then
			task.defer(refreshIcon, button, state)
		end
	end)
	connect(button.DescendantRemoving, function(object)
		if object == state.icon then
			restoreIcon(state)
			task.defer(refreshIcon, button, state)
		end
	end)
	connect(button.AncestryChanged, function()
		if button:IsDescendantOf(gui) then
			watchVisibility(button, state)
		else
			cleanupButton(button)
		end
	end)
	connect(button.Destroying, function()
		cleanupButton(button)
	end)
	watchVisibility(button, state)
end

-- Release correctly even when the mouse leaves the button.
UserInputService.InputEnded:Connect(function(input)
	for _, state in pairs(states) do
		local mouseRelease = input.UserInputType == Enum.UserInputType.MouseButton1
			and state.pressInput
			and state.pressInput.UserInputType == Enum.UserInputType.MouseButton1

		if state.pressed and (input == state.pressInput or mouseRelease) then
			state.pressed = false
			state.touching = false
			state.pressInput = nil
			update(state)
		end
	end
end)

UserInputService.WindowFocusReleased:Connect(function()
	for _, state in pairs(states) do
		state.hovered = false
		state.pressed = false
		state.touching = false
		state.pressInput = nil
		update(state)
	end
end)

-- Wait for the UI to have sizes before choosing each button's main icon.
task.defer(function()
	for _, object in ipairs(gui:GetDescendants()) do
		if object:IsA("GuiButton") then
			setupButton(object)
		end
	end
end)

gui.DescendantAdded:Connect(function(object)
	if object:IsA("GuiButton") then
		task.defer(setupButton, object)
	end
end)

-- Disconnect removed buttons so respawns/recreated GUIs do not accumulate listeners.
gui.DescendantRemoving:Connect(function(object)
	if object:IsA("GuiButton") then
		cleanupButton(object)
	end
end)
