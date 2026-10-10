local Players = game:GetService("Players")
local playerGui = Players.LocalPlayer:WaitForChild("PlayerGui")
local watched = {}

local function isPlatformArea(instance)
	while instance and instance ~= game do
		if instance.Name == "platformarea_parts" or instance.Name == "platformarea_support"
			or (instance:IsA("BasePart") and instance.Name:lower() == "status"
				and instance.Parent and instance.Parent.Name == "Platform") then
			return true
		end
		instance = instance.Parent
	end
	return false
end

local function lockSize(gui)
	if not gui:IsA("BillboardGui") or watched[gui] then return end
	if not isPlatformArea(gui.Parent) and not isPlatformArea(gui.Adornee) then return end

	local pixels = gui:GetAttribute("FixedScreenSize")
	if typeof(pixels) ~= "Vector2" then
		local size = gui.Size
		pixels = Vector2.new(
			size.X.Offset > 0 and size.X.Offset or 300,
			size.Y.Offset > 0 and size.Y.Offset or 50
		)
	end
	local fixed = UDim2.fromOffset(pixels.X, pixels.Y)
	local function apply()
		if gui.Size ~= fixed then gui.Size = fixed end
	end
	apply()
	local connections = {}
	watched[gui] = connections
	connections[1] = gui:GetPropertyChangedSignal("Size"):Connect(apply)
	connections[2] = gui.Destroying:Connect(function()
		for _, connection in connections do connection:Disconnect() end
		watched[gui] = nil
	end)
end

local function added(instance)
	if instance:IsA("BillboardGui") then
		lockSize(instance)
	elseif instance.Name == "platformarea_parts" or instance.Name == "platformarea_support"
		or (instance:IsA("BasePart") and instance.Name:lower() == "status") then
		for _, child in instance:GetDescendants() do lockSize(child) end
	end
end

workspace.DescendantAdded:Connect(added)
playerGui.DescendantAdded:Connect(added)
for _, gui in workspace:GetDescendants() do lockSize(gui) end
for _, gui in playerGui:GetDescendants() do lockSize(gui) end
