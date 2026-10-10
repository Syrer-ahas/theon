local Players = game:GetService("Players")
local RunService = game:GetService("RunService")
local ProximityPromptService = game:GetService("ProximityPromptService")
local PlotOwnership = require(game:GetService("ReplicatedStorage"):WaitForChild("PlotOwnership"))
local player = Players.LocalPlayer
local prompts = {}
local selected
local elapsed = 0

ProximityPromptService.MaxPromptsVisible = 1

local function watch(prompt)
	if not prompt:IsA("ProximityPrompt") or prompts[prompt] then return end
	local connections={}
	prompts[prompt] = connections
	prompt.Exclusivity = Enum.ProximityPromptExclusivity.AlwaysShow
	prompt.RequiresLineOfSight = false
	-- Wait for the server's availability attribute before enabling this client.
	prompt.Enabled = false
	connections[1]=prompt.Destroying:Once(function()
		prompts[prompt] = nil
		if selected == prompt then selected = nil end
	end)
end

local function positionOf(prompt)
	local parent = prompt.Parent
	if not parent then return nil end
	if parent:IsA("Attachment") then return parent.WorldPosition end
	if parent:IsA("BasePart") then return parent.Position end
	if parent:IsA("Model") then return parent:GetPivot().Position end
	return nil
end

local function update()
	local character = player.Character
	local root = character and character:FindFirstChild("HumanoidRootPart")
	local humanoid = character and character:FindFirstChildOfClass("Humanoid")
	local nearest
	local nearestDistance = math.huge
	if root and humanoid and humanoid.Health > 0 and ProximityPromptService.Enabled then
		for prompt in prompts do
			local position = positionOf(prompt)
			if position and prompt:GetAttribute("ServerPromptEnabled") == true
				and (prompt:GetAttribute("PlatformRollPrompt") ~= true
					or PlotOwnership.CanUse(player, prompt.Parent)) then
				local distance = (root.Position - position).Magnitude
				if distance <= prompt.MaxActivationDistance
					and (distance < nearestDistance - 0.001
						or (math.abs(distance - nearestDistance) <= 0.001 and prompt == selected)) then
					nearest = prompt
					nearestDistance = distance
				end
			end
		end
	end
	-- Disable the previous prompt before enabling the next one.
	for prompt in prompts do
		if prompt ~= nearest and prompt.Enabled then prompt.Enabled = false end
	end
	selected = nearest
	if nearest and not nearest.Enabled then nearest.Enabled = true end
end

workspace.DescendantAdded:Connect(watch)
workspace.DescendantRemoving:Connect(function(instance)
 local connections=prompts[instance]
 if not connections then return end
 for _,connection in connections do connection:Disconnect() end
 prompts[instance]=nil
 if selected==instance then selected=nil end
end)
for _,instance in workspace:GetDescendants() do watch(instance) end
RunService.Heartbeat:Connect(function(dt)
	elapsed += dt
	if elapsed < 0.05 then return end
	elapsed = 0
	update()
end)
