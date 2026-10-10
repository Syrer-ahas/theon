local CategorySelection = require(game.ReplicatedStorage:WaitForChild("RollCategorySelection"))
CategorySelection.Initialize()
local ItemPurchase = require(game.ServerScriptService:WaitForChild("RolledItemPurchase"))
local Players = game:GetService("Players")
local HttpService = game:GetService("HttpService")
local confirmation = game.ReplicatedStorage:FindFirstChild("ConfirmRollSkip") or Instance.new("RemoteEvent")
confirmation.Name = "ConfirmRollSkip"
confirmation.Parent = game.ReplicatedStorage
local pending = {}
local requestRoll = {}
local protectedRarities = {Legendary = true, Mythic = true, Secret = true}
local function cancelPending(player)
 local request = pending[player]
 pending[player] = nil
 if request then confirmation:FireClient(player, "Close", request.token) end
end
confirmation.OnServerEvent:Connect(function(player, token, accepted)
 if typeof(token) ~= "string" or typeof(accepted) ~= "boolean" then return end
 local request = pending[player]
 if not request or request.token ~= token then return end
 if not accepted then cancelPending(player); return end
 local now = workspace:GetServerTimeNow()
 if now < request.readyAt then return end
 cancelPending(player)
 if now > request.expiresAt then return end
 local offer = ItemPurchase.GetOffer(request.spinner, player)
 if offer ~= request.offer then return end
 local roll = requestRoll[request.spinner]
 if roll then roll(player, offer) end
end)
Players.PlayerRemoving:Connect(function(player) pending[player] = nil end)

local revealPool = {}
for _, name in {"blocks", "Engines", "Fuel", "tires"} do
	local folder = game:GetService("ReplicatedStorage"):WaitForChild("RollPartTemplates"):FindFirstChild(name)
	if folder then
		for _, item in folder:GetChildren() do
			if item:IsA("Model") or item:IsA("BasePart") then table.insert(revealPool, item) end
		end
	end
end
local supportPool = {}
for _,item in game.ReplicatedStorage.RollPartTemplates:WaitForChild("Supports"):GetChildren() do
	if item:IsA("Model") or item:IsA("BasePart") then table.insert(supportPool,item) end
end
local revealRandom = Random.new()
local function chooseSupport()
	local total = 0
	for _,item in supportPool do total += item:GetAttribute("RollWeight") or 1 end
	assert(#supportPool > 0 and total > 0, "No support items")
	local target, accumulated = revealRandom:NextNumber() * total, 0
	local chosen = supportPool[#supportPool]
	for _,item in supportPool do
		accumulated += item:GetAttribute("RollWeight") or 1
		if target < accumulated then chosen=item; break end
	end
	return chosen, (chosen:GetAttribute("RollWeight") or 1)/total, total
end
local rarityExponent = script:GetAttribute("RarityExponent") or 1.9
local rarityWeightTotal = 0
for _, item in revealPool do
	local value = item:GetAttribute("Odds")
	assert(typeof(value) == "number" and value >= 1, "Invalid rarity value: " .. item.Name)
	local weight = value ^ -rarityExponent
	if item:GetAttribute("Rarity") == "Common" then
		weight *= script:GetAttribute("CommonWeightMultiplier") or 0.75
	end
	item:SetAttribute("RollWeight", weight)
	rarityWeightTotal += weight
end
for _, item in revealPool do
	local probability = item:GetAttribute("RollWeight") / rarityWeightTotal
	item:SetAttribute("RollProbability", probability)
	item:SetAttribute("ActualOdds", 1 / probability)
end

local PlotOwnership = require(game:GetService("ReplicatedStorage"):WaitForChild("PlotOwnership"))

local function setup(station)
	local marker = station:WaitForChild("Marker").Value
	local spinner = station:WaitForChild("Spinner").Value
	if not marker or not spinner then return end
	local prompt = marker:WaitForChild("RollPrompt")
	local sound = spinner:WaitForChild("RollSound")
	local busy = false
	local displayReference = spinner:FindFirstChild("RollDisplay")
	if displayReference and displayReference.Value then ItemPurchase.Setup(spinner, marker, displayReference.Value) end

	local function roll(player, confirmedOffer)
		if busy or not prompt.Enabled or not spinner.Parent then return end
		local plot = PlotOwnership.FindPlot(marker)
		if not PlotOwnership.CanUse(player, marker) or PlotOwnership.FindPlot(spinner) ~= plot then return end
		local character = player.Character
		local root = character and character:FindFirstChild("HumanoidRootPart")
		local humanoid = character and character:FindFirstChildOfClass("Humanoid")
		if not root or not humanoid or humanoid.Health <= 0 then return end
		if (root.Position - marker.Position).Magnitude > prompt.MaxActivationDistance + 2 then return end

  local offer = ItemPurchase.GetOffer(spinner, player)
  if offer and protectedRarities[offer.item:GetAttribute("Rarity")] and confirmedOffer ~= offer then
   local existing = pending[player]
   if existing and existing.spinner == spinner and existing.offer == offer
    and workspace:GetServerTimeNow() < existing.expiresAt then return end
   cancelPending(player)
   local token = HttpService:GenerateGUID(false)
   local readyAt = workspace:GetServerTimeNow() + 4
   local request = {token = token, spinner = spinner, offer = offer, readyAt = readyAt, expiresAt = readyAt + 30}
   pending[player] = request
   confirmation:FireClient(player, "Open", token, offer.item:GetAttribute("Rarity"), readyAt)
   task.delay(34, function() if pending[player] == request then cancelPending(player) end end)
   return
  end
  cancelPending(player)

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
		local duration = math.clamp(script:GetAttribute("RollDuration") or 5, 0.6, 30)
		local cooldown = math.clamp(script:GetAttribute("RollCooldown") or 0, 0, 30)
		local turns = math.clamp(math.floor(script:GetAttribute("SpinTurns") or 10), 1, 12)
		spinner.CanCollide = false
		spinner:SetAttribute("RollBasePivot", originalPivot)
		spinner:SetAttribute("RollTiltAxis", tiltAxis)
		spinner:SetAttribute("RollSpinAxis", spinAxis)
		spinner:SetAttribute("RollDuration", duration)
		spinner:SetAttribute("RollTurns", turns)
		spinner:SetAttribute("RollPullAngle", math.clamp(script:GetAttribute("PullAngle") or 65, 5, 80))
		spinner:SetAttribute("RollStartedAt", workspace:GetServerTimeNow())
		local display = spinner:FindFirstChild("RollDisplay")
		if display and display.Value and #revealPool > 0 then
			local result = spinner:FindFirstChild("RollResult") or Instance.new("ObjectValue")
			result.Name = "RollResult"
			local mask = CategorySelection.GetMask(player)
			local chosen, probability, totalWeight
			if spinner:GetAttribute("RollPool") == "Supports" then
				chosen, probability, totalWeight = chooseSupport()
			else
				chosen, probability, totalWeight = CategorySelection.Choose(revealPool, mask, revealRandom)
			end
			spinner:SetAttribute("RollCategoryMask", mask)
			spinner:SetAttribute("RollSelectedWeightTotal", totalWeight)
			spinner:SetAttribute("RollResultProbability", probability)
			spinner:SetAttribute("RollResultActualOdds", 1 / probability)
			result.Value = chosen
			ItemPurchase.SetOffer(spinner, chosen, player, workspace:GetServerTimeNow() + duration)
			result.Parent = spinner
		end
		spinner:SetAttribute("Rolling", true)

		local success, reason = xpcall(function()
			sound:Stop()
			sound.Looped = false
			sound.TimePosition = 0
			sound:Play()

			task.wait(duration)
		end, debug.traceback)

		-- The one-shot interaction sound finishes naturally.
		if spinner.Parent then
			spinner:PivotTo(originalPivot)
			spinner.CanCollide = originalCollision
			spinner:SetAttribute("Rolling", false)
			ItemPurchase.Reveal(spinner)
		end
		-- Unlock immediately when the final item is revealed.
		if cooldown > 0 then task.wait(cooldown) end
		busy = false
		if prompt.Parent and spinner.Parent then prompt.Enabled = true end
		if not success then warn("Platform spin failed: " .. tostring(reason)) end
	end
 requestRoll[spinner] = roll
 prompt.Triggered:Connect(function(player) roll(player) end)
end

for _, station in script:WaitForChild("Stations"):GetChildren() do
	setup(station)
end
