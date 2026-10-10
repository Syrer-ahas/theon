local gui = script.Parent
local cameraConnection

local function layout()
	local camera = workspace.CurrentCamera
	if not camera then return end
	local viewport = camera.ViewportSize
	if viewport.X <= 0 or viewport.Y <= 0 then return end
	local width = gui:GetAttribute("DesignWidth")
	local height = gui:GetAttribute("DesignHeight")
	local scale = math.min(viewport.X * 0.84 / width, viewport.Y * 0.82 / height, 960 / 4193)
	for _, node in gui:GetChildren() do
		if node:IsA("GuiObject") and node:GetAttribute("DesignX") ~= nil then
			local x, y = node:GetAttribute("DesignX"), node:GetAttribute("DesignY")
			local w, h = node:GetAttribute("DesignWidth"), node:GetAttribute("DesignHeight")
			node.Position = UDim2.new(0.5, (x + w / 2 - width / 2) * scale, 0.5, (y + h / 2 - height / 2) * scale)
			node.Size = UDim2.fromOffset(w * scale, h * scale)
		end
	end
end

local function bindCamera()
	if cameraConnection then cameraConnection:Disconnect() end
	local camera = workspace.CurrentCamera
	if camera then cameraConnection = camera:GetPropertyChangedSignal("ViewportSize"):Connect(layout) end
	layout()
end

workspace:GetPropertyChangedSignal("CurrentCamera"):Connect(bindCamera)
bindCamera()

local close = gui:WaitForChild("CloseButton")
close.Activated:Connect(function()
	gui.Enabled = false
end)

local requested = gui:WaitForChild("ButtonActivated")
for _, node in gui:GetChildren() do
	if node:IsA("ImageButton") and node ~= close then
		node.Activated:Connect(function()
			if gui.Name == "Index" then
				gui:SetAttribute("SelectedCategory", node.Name:gsub("Button$", ""))
			end
			requested:Fire(node.Name)
		end)
	end
end

script.Destroying:Connect(function()
	if cameraConnection then cameraConnection:Disconnect() end
end)
