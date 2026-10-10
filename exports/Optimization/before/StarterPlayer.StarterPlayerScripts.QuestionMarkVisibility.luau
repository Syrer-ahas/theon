local Players = game:GetService("Players")
local RunService = game:GetService("RunService")
local tracked = {}
local function track(instance)
	if instance:IsA("Highlight") and instance:GetAttribute("QuestionMarkMaxDistance") then
		tracked[instance] = true
	end
end
for _, instance in workspace:GetDescendants() do track(instance) end
workspace.DescendantAdded:Connect(track)
workspace.DescendantRemoving:Connect(function(instance) tracked[instance] = nil end)
RunService:BindToRenderStep("PlatformHighlightVisibility", Enum.RenderPriority.Camera.Value + 1, function()
	local camera = workspace.CurrentCamera
	if not camera then return end
	for highlight in tracked do
		local part = highlight.Adornee or highlight.Parent
		local visible = false
		if part:IsA("BasePart") then
			local direction = part.Position - camera.CFrame.Position
			if direction.Magnitude <= (highlight:GetAttribute("QuestionMarkMaxDistance") or 65) then
				-- Ignore the sign's own pieces, so the inset question mark stays visible.
				local ignored = {part}
				if part.Parent:IsA("Model") and (part.Parent.Name == "carpart" or part.Parent.Name == "support") then
					table.insert(ignored, part.Parent)
				end
				local character = Players.LocalPlayer.Character
				if character then table.insert(ignored, character) end
				for _, sibling in part.Parent:GetChildren() do
					if sibling:IsA("BasePart") and (sibling.Name == "parts"
						or sibling.Name == "support" or sibling.Name == "loa"
						or sibling.Name == "Dot" or sibling.Name == "Curl"
						or sibling.Name == "ThickOutline") then
						table.insert(ignored, sibling)
					end
				end
				local params = RaycastParams.new()
				params.FilterType = Enum.RaycastFilterType.Exclude
				params.FilterDescendantsInstances = ignored
				visible = workspace:Raycast(camera.CFrame.Position, direction, params) == nil
			end
		end
		highlight.DepthMode = Enum.HighlightDepthMode.AlwaysOnTop
		local ancestor = part.Parent
		while ancestor and ancestor ~= workspace do
			if ancestor:GetAttribute("HiddenForRoll") then visible = false break end
			ancestor = ancestor.Parent
		end
		highlight.Enabled = visible
	end
end)
