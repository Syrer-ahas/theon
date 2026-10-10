local gui = script.Parent
local panel = gui:WaitForChild("Panel")
local button = gui:WaitForChild("Button1")
local border = panel:WaitForChild("FigmaBorder")

local function resize()
	local viewport = gui.AbsoluteSize
	if viewport.X <= 0 or viewport.Y <= 0 then return end
	local width = math.min(900, viewport.X * 0.86, viewport.Y * 0.55 * 4069 / 1360)
	local scale = width / 4069
	local height = 1360 * scale
	panel.Size = UDim2.fromOffset(width, height)
	border.Thickness = 20 * scale
	button.Size = UDim2.fromOffset(964 * scale, 419 * scale)
	button.Position = UDim2.new(0.5, -width / 2 + 3052 * scale, 0.45, -height / 2 + 913 * scale)
end

gui:GetPropertyChangedSignal("AbsoluteSize"):Connect(resize)
resize()
