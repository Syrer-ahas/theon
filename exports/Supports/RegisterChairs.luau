-- Run in Studio Edit mode to register the authored chair meshes.
local source = workspace:WaitForChild("Supports")
local templates = game.ReplicatedStorage:WaitForChild("RollPartTemplates"):WaitForChild("Supports")
local controller = game.ServerScriptService:WaitForChild("PlatformSpinController")
local exponent = controller:GetAttribute("RarityExponent") or 1.9
local commonMultiplier = controller:GetAttribute("CommonWeightMultiplier") or 0.75
local definitions = {
 {name="PassangerSeat", id="Supports_PassengerSeat", display="Passenger Seat", rarity="Common", odds=3, price=100, role="Passenger"},
 {name="PILOTCHAIR", id="Supports_PilotChair", display="Pilot Chair", rarity="Uncommon", odds=5, price=250, role="Pilot"},
}

for _,definition in definitions do
 local mesh = assert(source:FindFirstChild(definition.name), "Missing chair: " .. definition.name)
 assert(mesh:IsA("BasePart") or mesh:IsA("Model"), "Chair must be a part or model")
 mesh:SetAttribute("RollItemId", definition.id)
 mesh:SetAttribute("DisplayName", definition.display)
 mesh:SetAttribute("Rarity", mesh:GetAttribute("Rarity") or definition.rarity)
 mesh:SetAttribute("Odds", mesh:GetAttribute("Odds") or definition.odds)
 mesh:SetAttribute("Price", mesh:GetAttribute("Price") or definition.price)
 mesh:SetAttribute("PurchaseQuantity", 1)
 mesh:SetAttribute("SeatRole", definition.role)
 local weight = mesh:GetAttribute("Odds") ^ -exponent
 if mesh:GetAttribute("Rarity") == "Common" then weight *= commonMultiplier end
 mesh:SetAttribute("RollWeight", weight)
 local existing = templates:FindFirstChild(definition.name)
 if existing then
  assert(existing:GetAttribute("RollItemId") == definition.id, "Chair name conflicts with another support")
  existing:Destroy()
 end
 local template = mesh:Clone()
 template.Parent = templates
end

local total = 0
for _,item in templates:GetChildren() do
 if item:IsA("Model") or item:IsA("BasePart") then total += item:GetAttribute("RollWeight") or 1 end
end
for _,item in templates:GetChildren() do
 if item:IsA("Model") or item:IsA("BasePart") then
  local probability = (item:GetAttribute("RollWeight") or 1) / total
  item:SetAttribute("RollProbability", probability)
  item:SetAttribute("ActualOdds", 1 / probability)
 end
end
