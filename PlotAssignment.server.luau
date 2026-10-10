local Players = game:GetService("Players")
local plotsRoot = workspace:FindFirstChild("Plots") or workspace:FindFirstChild("plots") or workspace
local plots = {}
local assignments = {}
local characterConnections = {}
local spawns = {}

for _, plot in plotsRoot:GetChildren() do
	if (plot:IsA("Folder") or plot:IsA("Model")) and plot.Name:match("^Plot%d+$") then
		table.insert(plots, plot)
		local marker = plot:FindFirstChild("spawn")
		if marker and marker:IsA("BasePart") then
			local spawn = plot:FindFirstChild("PlayerSpawn")
			if not spawn then
				spawn = Instance.new("SpawnLocation")
				spawn.Name = "PlayerSpawn"
				spawn.Anchored = true
				spawn.CanCollide = false
				spawn.CanTouch = false
				spawn.Transparency = 1
				spawn.Size = marker.Size
				spawn.CFrame = marker.CFrame
				spawn.Neutral = true
				spawn.Duration = 0
				spawn.Parent = plot
			end
			spawns[plot] = spawn
		end
	end
end
table.sort(plots, function(a, b)
	return tonumber(a.Name:match("%d+")) < tonumber(b.Name:match("%d+"))
end)

local function setDisplay(plot, player)
	local status = plot:FindFirstChild("Status")
	local gui = status and status:FindFirstChildWhichIsA("BillboardGui")
	local text = gui and gui:FindFirstChild("TXT")
	local pfp = gui and gui:FindFirstChild("PFP")
	if text then text.Text = player and player.Name or "" end
	if not pfp then return end
	pfp.Image = ""
	if player then
		task.defer(function()
			local ok, image = pcall(Players.GetUserThumbnailAsync, Players, player.UserId,
				Enum.ThumbnailType.HeadShot, Enum.ThumbnailSize.Size420x420)
			if ok and player.Parent == Players and pfp.Parent
				and plot:GetAttribute("OwnerUserId") == player.UserId then
				pfp.Image = image
			end
		end)
	end
end

local function assign(player)
	if assignments[player] or player.Parent ~= Players then return end
	local selected
	for _, plot in plots do
		if plot:GetAttribute("OwnerUserId") == player.UserId then selected = plot; break end
	end
	if not selected and script:GetAttribute("TestPlotEnabled") == true
		and player.UserId == script:GetAttribute("TestUserId") then
		local preferred = plotsRoot:FindFirstChild(script:GetAttribute("TestPlotName") or "Plot4")
		local owner = preferred and preferred:GetAttribute("OwnerUserId")
		if preferred and (owner == nil or owner == 0) then selected = preferred end
	end
	if not selected then
		for _, plot in plots do
			local owner = plot:GetAttribute("OwnerUserId")
			if owner == nil or owner == 0 then selected = plot; break end
		end
	end
	if not selected then return end

	assignments[player] = selected
	selected:SetAttribute("OwnerUserId", player.UserId)
	player:SetAttribute("PlotName", selected.Name)
	player.RespawnLocation = spawns[selected]
	local assignedPlot = player:FindFirstChild("AssignedPlot")
	if not assignedPlot then
		assignedPlot = Instance.new("ObjectValue")
		assignedPlot.Name = "AssignedPlot"
		assignedPlot.Parent = player
	end
	assignedPlot.Value = selected

	local function moveToPlot(character)
		local root = character:FindFirstChild("HumanoidRootPart")
			or character:WaitForChild("HumanoidRootPart", 5)
		local marker = selected:FindFirstChild("spawn")
		if root and marker and character.Parent and player.Character == character
			and assignments[player] == selected then
			character:PivotTo(marker.CFrame + Vector3.new(0, 3, 0))
		end
	end
	characterConnections[player] = player.CharacterAdded:Connect(moveToPlot)
	if player.Character then task.spawn(moveToPlot, player.Character) end
	setDisplay(selected, player)
end

local function release(player)
	local plot = assignments[player]
	assignments[player] = nil
	if characterConnections[player] then
		characterConnections[player]:Disconnect()
		characterConnections[player] = nil
	end
	if plot and plot:GetAttribute("OwnerUserId") == player.UserId then
		plot:SetAttribute("OwnerUserId", nil)
		setDisplay(plot, nil)
	end
	player:SetAttribute("PlotName", nil)
	player.RespawnLocation = nil
	local assignedPlot = player:FindFirstChild("AssignedPlot")
	if assignedPlot then assignedPlot.Value = nil end
	for _, waitingPlayer in Players:GetPlayers() do
		if waitingPlayer ~= player and not assignments[waitingPlayer] then assign(waitingPlayer) end
	end
end

Players.PlayerAdded:Connect(assign)
Players.PlayerRemoving:Connect(release)
for _, player in Players:GetPlayers() do assign(player) end
