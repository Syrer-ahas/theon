local player = game.Players.LocalPlayer
local money = player:WaitForChild("leaderstats"):WaitForChild("Money")
local playerGui = player:WaitForChild("PlayerGui")
local label
local function format(value)
	local function compact(number, suffix)
		return string.format("%.1f", number):gsub("%.0$", "") .. suffix
	end
	if value >= 1000000 then return compact(value / 1000000, "m") end
	if value >= 1000 then return compact(value / 1000, "k") end
	return tostring(value)
end
local function refresh()
	local frontend = playerGui:FindFirstChild("frontend")
	local container = frontend and frontend:FindFirstChild("MoneyContainer")
	label = container and container:FindFirstChild("TextLabel")
	if label then label.Text = format(money.Value) end
end
money.Changed:Connect(refresh)
playerGui.DescendantAdded:Connect(function(instance)
	if instance.Name == "MoneyContainer" or instance.Name == "TextLabel" then task.defer(refresh) end
end)
refresh()
