local Players = game:GetService("Players")
local ProximityPromptService = game:GetService("ProximityPromptService")
local UserInputService = game:GetService("UserInputService")
local TextService = game:GetService("TextService")

ProximityPromptService.MaxPromptsVisible = 1

local player = Players.LocalPlayer
local PlotOwnership = require(game:GetService("ReplicatedStorage"):WaitForChild("PlotOwnership"))
local playerGui = player:WaitForChild("PlayerGui")
local active = {}
local visible = {}
local watchedPlots = {}

local function dismiss(prompt)
	local entry = active[prompt]
	if not entry then return end
	active[prompt] = nil
	for _, connection in entry.connections do connection:Disconnect() end
	if entry.holding then prompt:InputHoldEnd() end
	entry.gui:Destroy()
end

local function show(prompt, inputType)
	if prompt:GetAttribute("PlatformRollPrompt") ~= true then return end
	dismiss(prompt)
	if not PlotOwnership.CanUse(player, prompt.Parent) then return end
	for other in active do
		if other ~= prompt then dismiss(other) end
	end

	local actionWidth = math.max(75, math.ceil(TextService:GetTextSize(prompt.ActionText, 18,
		Enum.Font.GothamBlack, Vector2.new(1000, 56)).X) + 10)
	local gui = Instance.new("BillboardGui")
	gui.Name = "PlatformRollPrompt"
	gui.Adornee = prompt.Parent
	gui.Size = UDim2.fromOffset(63 + actionWidth, 56)
	gui.StudsOffsetWorldSpace = Vector3.new(0, 0.75, 0)
	gui.AlwaysOnTop = true
	gui.LightInfluence = 0
	gui.Active = true
	gui.ResetOnSpawn = false
	gui.ZIndexBehavior = Enum.ZIndexBehavior.Sibling
	gui.Parent = playerGui

	local hit = Instance.new("TextButton")
	hit.Name = "PromptHitTarget"
	hit.BackgroundTransparency = 1
	hit.Text = ""
	hit.AutoButtonColor = false
	hit.Size = UDim2.fromScale(1, 1)
	hit.Parent = gui

	local circle = Instance.new("Frame")
	circle.Name = "KeyBackground"
	circle.BackgroundColor3 = Color3.fromRGB(24, 23, 29)
	circle.BackgroundTransparency = 0.3
	circle.BorderSizePixel = 0
	circle.Position = UDim2.fromOffset(5, 5)
	circle.Size = UDim2.fromOffset(46, 46)
	circle.ZIndex = 3
	circle.Parent = hit
	local round = Instance.new("UICorner")
	round.CornerRadius = UDim.new(1, 0)
	round.Parent = circle

	local key = Instance.new("TextLabel")
	key.Name = "Key"
	key.AnchorPoint = Vector2.new(0.5, 0.5)
	key.Position = UDim2.fromScale(0.5, 0.5)
	key.Size = UDim2.fromOffset(26, 29)
	key.BackgroundTransparency = 1
	key.Font = Enum.Font.GothamBold
	key.TextColor3 = Color3.new(1, 1, 1)
	key.TextSize = 18
	key.Text = inputType == Enum.ProximityPromptInputType.Touch and "TAP"
		or inputType == Enum.ProximityPromptInputType.Gamepad and "X"
		or UserInputService:GetStringForKeyCode(prompt.KeyboardKeyCode)
	if inputType == Enum.ProximityPromptInputType.Touch then key.TextSize = 11 end
	key.Parent = circle
	local keyRound = Instance.new("UICorner")
	keyRound.CornerRadius = UDim.new(0, 9)
	keyRound.Parent = key
	local outline = Instance.new("UIStroke")
	outline.ApplyStrokeMode = Enum.ApplyStrokeMode.Border
	outline.Thickness = 2
	outline.Color = Color3.new(1, 1, 1)
	outline.Parent = key

	-- Follow the letters with a feathered shadow instead of a rounded patch.
	local fog = Instance.new("Frame")
	fog.Name = "ActionFog"
	fog.BackgroundTransparency = 1
	fog.Position = UDim2.fromOffset(62, 2)
	fog.Size = UDim2.fromOffset(actionWidth, 56)
	fog.ZIndex = 2
	fog.Active = false
	fog.Parent = hit
	for i, thickness in {9, 8, 7, 6, 5, 4, 3} do
		local shadow = Instance.new("TextLabel")
		shadow.Name = "Shadow" .. i
		shadow.BackgroundTransparency = 1
		shadow.Size = UDim2.fromScale(1, 1)
		shadow.Font = Enum.Font.GothamBlack
		shadow.Text = prompt.ActionText
		shadow.TextSize = 18
		shadow.TextColor3 = Color3.new(0, 0, 0)
		shadow.TextTransparency = 0.93
		shadow.TextXAlignment = Enum.TextXAlignment.Left
		shadow.ZIndex = 2
		shadow.Active = false
		shadow.Parent = fog
		local softOutline = Instance.new("UIStroke")
		softOutline.Thickness = thickness
		softOutline.Color = Color3.new(0, 0, 0)
		softOutline.Transparency = 0.985 - i * 0.013
		softOutline.Parent = shadow
	end

	local label = Instance.new("TextLabel")
	label.Name = "Action"
	label.BackgroundTransparency = 1
	label.Position = UDim2.fromOffset(62, 0)
	label.Size = UDim2.fromOffset(actionWidth, 56)
	label.Font = Enum.Font.GothamBlack
	label.Text = prompt.ActionText
	label.TextSize = 18
	label.TextColor3 = Color3.fromRGB(166, 255, 0)
	label.TextXAlignment = Enum.TextXAlignment.Left
	label.ZIndex = 3
	label.Parent = hit
	local textOutline = Instance.new("UIStroke")
	textOutline.Thickness = 2
	textOutline.Color = Color3.new(0, 0, 0)
	textOutline.Parent = label

	local entry = {gui = gui, connections = {}, holding = false}
	active[prompt] = entry
	local function release()
		if entry.holding then
			entry.holding = false
			prompt:InputHoldEnd()
		end
	end
	table.insert(entry.connections, hit.InputBegan:Connect(function(input)
		if input.UserInputType == Enum.UserInputType.MouseButton1
			or input.UserInputType == Enum.UserInputType.Touch then
			if not PlotOwnership.CanUse(player, prompt.Parent) then return end
			entry.holding = true
			prompt:InputHoldBegin()
		end
	end))
	table.insert(entry.connections, UserInputService.InputEnded:Connect(function(input)
		if input.UserInputType == Enum.UserInputType.MouseButton1
			or input.UserInputType == Enum.UserInputType.Touch then release() end
	end))
	table.insert(entry.connections, prompt.Destroying:Connect(function() dismiss(prompt) end))
end

local function refreshVisible()
	for prompt, inputType in visible do show(prompt, inputType) end
end

ProximityPromptService.PromptShown:Connect(function(prompt, inputType)
	for other in active do
		if other ~= prompt then dismiss(other) end
	end
	if prompt:GetAttribute("PlatformRollPrompt") ~= true then return end
	visible[prompt] = inputType
	local plot = PlotOwnership.FindPlot(prompt.Parent)
	if plot and not watchedPlots[plot] then
		watchedPlots[plot] = plot:GetAttributeChangedSignal("OwnerUserId"):Connect(refreshVisible)
	end
	show(prompt, inputType)
end)
ProximityPromptService.PromptHidden:Connect(function(prompt)
	visible[prompt] = nil
	dismiss(prompt)
end)
player:GetAttributeChangedSignal("PlotName"):Connect(refreshVisible)
