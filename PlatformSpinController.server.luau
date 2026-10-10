local PlotOwnership = require(game:GetService("ReplicatedStorage"):WaitForChild("PlotOwnership"))

local function setup(station)
	local marker = station:WaitForChild("Marker").Value
	local spinner = station:WaitForChild("Spinner").Value
	if not marker or not spinner then return end
	local prompt = marker:WaitForChild("RollPrompt")
	local sound = spinner:WaitForChild("RollSound")
	local busy = false

	prompt.Triggered:Connect(function(player)
		if busy or not prompt.Enabled or not spinner.Parent then return end
		local plot = PlotOwnership.FindPlot(marker)
		if not PlotOwnership.CanUse(player, marker) or PlotOwnership.FindPlot(spinner) ~= plot then return end
		local character = player.Character
		local root = character and character:FindFirstChild("HumanoidRootPart")
		local humanoid = character and character:FindFirstChildOfClass("Humanoid")
		if not root or not humanoid or humanoid.Health <= 0 then return end
		if (root.Position - marker.Position).Magnitude > prompt.MaxActivationDistance + 2 then return end

		busy = true
		prompt.Enabled = false
		local originalPivot = spinner:GetPivot()
		local originalCollision = spinner.CanCollide
		-- These are the union's local hinge and shaft axes, independent of the prompt.
		local hingeAxis = spinner:GetAttribute("RollHingeAxis") or Vector3.yAxis
		local shaftAxis = spinner:GetAttribute("RollShaftAxis") or Vector3.xAxis
		if typeof(hingeAxis) ~= "Vector3" or hingeAxis.Magnitude < 0.001 then hingeAxis = Vector3.yAxis end
		if typeof(shaftAxis) ~= "Vector3" or shaftAxis.Magnitude < 0.001 then shaftAxis = Vector3.xAxis end
		local tiltAxis = originalPivot:VectorToWorldSpace(hingeAxis.Unit)
		local spinAxis = originalPivot:VectorToWorldSpace(shaftAxis.Unit)
		local duration = math.clamp(script:GetAttribute("RollDuration") or 4, 0.6, 30)
		local cooldown = math.clamp(script:GetAttribute("RollCooldown") or 3, 0, 30)
		local turns = math.clamp(math.floor(script:GetAttribute("SpinTurns") or 10), 1, 12)
		spinner.CanCollide = false
		spinner:SetAttribute("RollBasePivot", originalPivot)
		spinner:SetAttribute("RollTiltAxis", tiltAxis)
		spinner:SetAttribute("RollSpinAxis", spinAxis)
		spinner:SetAttribute("RollDuration", duration)
		spinner:SetAttribute("RollTurns", turns)
		spinner:SetAttribute("RollPullAngle", math.clamp(script:GetAttribute("PullAngle") or 65, 5, 80))
		spinner:SetAttribute("RollStartedAt", workspace:GetServerTimeNow())
		spinner:SetAttribute("Rolling", true)

		local success, reason = xpcall(function()
			sound:Stop()
			sound.TimePosition = 0
			sound:Play()
			task.wait(duration)
		end, debug.traceback)

		if sound.Parent then sound:Stop() end
		if spinner.Parent then
			spinner:PivotTo(originalPivot)
			spinner.CanCollide = originalCollision
			spinner:SetAttribute("Rolling", false)
		end
		-- Keep the station locked for three seconds after the animation ends.
		task.wait(cooldown)
		busy = false
		if prompt.Parent and spinner.Parent then prompt.Enabled = true end
		if not success then warn("Platform spin failed: " .. tostring(reason)) end
	end)
end

for _, station in script:WaitForChild("Stations"):GetChildren() do
	setup(station)
end
