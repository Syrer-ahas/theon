-- One frontend navigation controller; Activated supports mouse, touch and gamepad.
local Players = game:GetService("Players")
local playerGui = Players.LocalPlayer:WaitForChild("PlayerGui")

local routes = {
	INDEX = {"Index"},
	["CO-OP"] = {"Co-op", "CoOp", "CoOpGui", "PlotAccess"},
	SHOP = {"ExclusiveShop"},
	SETTINGS = {"SettingsGui", "Settings"},
}
local connections = {}

local function normalized(name)
	return name:lower():gsub("[%s_%-]", "")
end

local function findTarget(names)
	for _, name in ipairs(names) do
		for _, gui in ipairs(playerGui:GetChildren()) do
			if gui:IsA("ScreenGui") and normalized(gui.Name) == normalized(name) then
				return gui
			end
		end
	end
end

local function openMenu(names)
	local target = findTarget(names)
	if not target then
		warn("Frontend navigation: missing ScreenGui " .. table.concat(names, " / "))
		return
	end

	-- Switching menus keeps a previous panel from covering the newly opened one.
	for _, otherNames in pairs(routes) do
		local other = findTarget(otherNames)
		if other and other ~= target then
			other.Enabled = false
		end
	end
	target.Enabled = true
end

local function bindButton(button)
	if not button:IsA("GuiButton") or connections[button] then return end
	local screenGui = button:FindFirstAncestorWhichIsA("ScreenGui")
	if not screenGui then return end

	if normalized(screenGui.Name) == "frontend" and routes[button.Name:upper()] then
		local names = routes[button.Name:upper()]
		button.Active = true
		connections[button] = button.Activated:Connect(function()
			openMenu(names)
		end)
	elseif button.Name == "CloseButton" then
		for _, names in pairs(routes) do
			if findTarget(names) == screenGui then
				button.Active = true
				connections[button] = button.Activated:Connect(function()
					screenGui.Enabled = false
				end)
				break
			end
		end
	end
end

playerGui.DescendantAdded:Connect(function(object)
	if object:IsA("GuiButton") then task.defer(bindButton, object) end
end)
playerGui.DescendantRemoving:Connect(function(object)
	if connections[object] then
		connections[object]:Disconnect()
		connections[object] = nil
	end
end)

for _, object in ipairs(playerGui:GetDescendants()) do
	bindButton(object)
end
