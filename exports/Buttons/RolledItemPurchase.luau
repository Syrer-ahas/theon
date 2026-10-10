local Players = game:GetService("Players")
local PlotOwnership = require(game.ReplicatedStorage:WaitForChild("PlotOwnership"))
local Purchase = {}
local stations = {}

local InventoryData = require(game.ServerScriptService:WaitForChild('PlayerInventoryData'))

function Purchase.TryPurchase(player, spinner)
	if player:GetAttribute('InventoryDataLoaded') ~= true then return false, 'Inventory loading' end
	local station = stations[spinner]
	local offer = station and station.offer
	if not offer or offer.sold or offer.player ~= player or not station.prompt.Enabled
		or spinner:GetAttribute("Rolling") or workspace:GetServerTimeNow() < offer.readyAt then
		return false, "Unavailable"
	end
	if not PlotOwnership.CanUse(player, station.marker) then return false, "Not your plot" end
	local character = player.Character
	local root = character and character:FindFirstChild("HumanoidRootPart")
	local humanoid = character and character:FindFirstChildOfClass("Humanoid")
	if not root or not humanoid or humanoid.Health <= 0
		or (root.Position - station.anchor.WorldPosition).Magnitude > station.prompt.MaxActivationDistance + 2 then
		return false, "Too far away"
	end
	local money = player.leaderstats:FindFirstChild("Money")
	if not money or money.Value < offer.price then
		return false, "Need $" .. tostring(offer.price - (money and money.Value or 0)) .. " more"
	end
	-- No yields between consuming the offer, charging money, and adding inventory.
	offer.sold = true
	station.prompt.Enabled = false
	local item = offer.item
	local entry = player.OwnedParts:FindFirstChild(item:GetAttribute("RollItemId"))
	if not entry then
		entry = Instance.new("IntValue")
		entry.Name = item:GetAttribute("RollItemId")
		entry:SetAttribute("DisplayName", item:GetAttribute("DisplayName") or item.Name)
		entry:SetAttribute("Category", item.Parent.Name)
		entry:SetAttribute("Rarity", item:GetAttribute("Rarity"))
		entry:SetAttribute("Price", offer.price)
		entry:SetAttribute("Odds", item:GetAttribute("Odds"))
		entry:SetAttribute("InventoryImage", item:GetAttribute("InventoryImage"))
		entry.Parent = player.OwnedParts
	end
	money.Value -= offer.price
	entry.Value += item:GetAttribute("PurchaseQuantity") or 1
	spinner:SetAttribute("PurchaseAvailable", false)
	spinner:SetAttribute("Purchased", true)
	InventoryData.QueueSave(player)
	return true, "Purchased"
end

function Purchase.Setup(spinner, marker, display)
	if stations[spinner] then return end
	local anchor = marker:FindFirstChild("PurchaseAnchor") or Instance.new("Attachment")
	anchor.Name = "PurchaseAnchor"
	local body = display:FindFirstChild("parts", true) or display:FindFirstChild("support", true)
	local position = body and body.Position or display:GetPivot().Position	local height = spinner:GetAttribute("RollDisplayHeight")
	if typeof(height) == "number" then position = Vector3.new(position.X, height, position.Z) end

	anchor.Position = marker.CFrame:PointToObjectSpace(position)
	anchor.Parent = marker
	local prompt = anchor:FindFirstChild("PurchaseItem") or Instance.new("ProximityPrompt")
	prompt.Name = "PurchaseItem"
	prompt.Enabled = false
	prompt.ActionText = "Buy"
	prompt.KeyboardKeyCode = Enum.KeyCode.F
	prompt.HoldDuration = 0
	prompt.MaxActivationDistance = 8
	prompt.RequiresLineOfSight = false
	prompt.Exclusivity = Enum.ProximityPromptExclusivity.AlwaysShow
	prompt.Style = Enum.ProximityPromptStyle.Custom
	prompt:SetAttribute("PlatformRollPrompt", true)
	prompt:SetAttribute("ItemPurchasePrompt", true)
	prompt.Parent = anchor
	local station = {marker = marker, anchor = anchor, prompt = prompt}
	stations[spinner] = station
	prompt.Triggered:Connect(function(player)
		local ok, message = Purchase.TryPurchase(player, spinner)
		if ok then return end
		local offer = station.offer
		if offer and offer.player == player and not offer.sold then
			prompt.ActionText = message
			task.delay(1.5, function()
				if station.offer == offer and not offer.sold then prompt.ActionText = "Buy $" .. offer.price end
			end)
		end
	end)
end

function Purchase.SetOffer(spinner, item, player, readyAt)
	local station = stations[spinner]
	if not station then return end
	station.prompt.Enabled = false
	spinner:SetAttribute("Purchased", false)
	spinner:SetAttribute("PurchaseAvailable", false)
	local price = item:GetAttribute("Price")
	assert(typeof(price) == "number" and price >= 0 and price == math.floor(price), "Invalid item price")
	station.offer = {item = item, player = player, price = price, readyAt = readyAt, sold = false}
	station.prompt.ActionText = "Buy $" .. price
	station.prompt.ObjectText = item:GetAttribute("DisplayName") or item.Name
	spinner:SetAttribute("PurchasePrice", price)
end

function Purchase.Reveal(spinner)
	local station = stations[spinner]
	local offer = station and station.offer
	if offer and not offer.sold and not spinner:GetAttribute("Rolling") then
		station.prompt.Enabled = true
		spinner:SetAttribute("PurchaseAvailable", true)
	end
end

function Purchase.GetOffer(spinner, player)
 local station = stations[spinner]
 local offer = station and station.offer
 if offer and offer.player == player and not offer.sold
  and not spinner:GetAttribute("Rolling") and workspace:GetServerTimeNow() >= offer.readyAt then
  return offer
 end
 return nil
end

return Purchase


