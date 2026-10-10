local CollectionService = game:GetService("CollectionService")
local RunService = game:GetService("RunService")
local TweenService = game:GetService("TweenService")
local Debris = game:GetService("Debris")
local Players = game:GetService("Players")
local PlotOwnership = require(game:GetService("ReplicatedStorage"):WaitForChild("PlotOwnership"))
local templates = game:GetService("ReplicatedStorage"):WaitForChild("RollPartTemplates")

local pool = {}
local categories = {}
local displayNames = {}
for _, name in {"blocks", "Engines", "Fuel", "tires"} do
	local folder = templates:WaitForChild(name)
	local bucket = {}
	for index, item in folder:GetChildren() do
		if item:IsA("Model") or item:IsA("BasePart") then
			table.insert(pool, item)
			table.insert(bucket, item)
			local title = item:GetAttribute("DisplayName")
			if not title then
				if name == "Engines" then title = "Engine " .. index
				elseif name == "Fuel" then title = "Fuel " .. (item.Name:match("%d+") or index)
				else
					title = item.Name:gsub("darkwooden", "Dark Wooden "):gsub("wooden", "Wooden ")
						:gsub("metal", "Metal "):gsub("glass", "Glass "):gsub("block", "Block"):gsub("slab", "Slab")
				end
			end
			displayNames[item] = title
		end
	end
	if #bucket > 0 then table.insert(categories, bucket) end
end

local visuals = Instance.new("Folder")
visuals.Name = "RollingPartVisuals"
visuals.Parent = workspace
local active, watched = {}, {}
local centers = {}
local random = Random.new()
local cinematic
local function finishCinematic()
	if not cinematic then return end
	local shot = cinematic
	cinematic = nil
	RunService:UnbindFromRenderStep("RarePartRevealCamera")
	if workspace.CurrentCamera == shot.camera then
		shot.camera.CFrame = shot.frame
		shot.camera.FieldOfView = shot.fov
		shot.camera.CameraSubject = shot.subject
		shot.camera.CameraType = shot.cameraType
	end
end

local function playCinematic(state)
	if not PlotOwnership.CanUse(Players.LocalPlayer, state.display) then return end
	finishCinematic()
	local camera = workspace.CurrentCamera
	if not camera then return end
	local focus = state.center + Vector3.new(0, 0.8, 0)
	local direction = camera.CFrame.Position - focus
	if direction.Magnitude < 0.1 then return end
	local distance = math.max(9, state.halfSize.Magnitude * 2.3)
	local target = CFrame.lookAt(focus + direction.Unit * distance, focus)
	local shot = {state = state, camera = camera, frame = camera.CFrame,
		fov = camera.FieldOfView, subject = camera.CameraSubject, cameraType = camera.CameraType, started = os.clock()}
	cinematic = shot
	camera.CameraType = Enum.CameraType.Scriptable
	RunService:BindToRenderStep("RarePartRevealCamera", Enum.RenderPriority.Camera.Value + 1, function()
		local progress = math.clamp((os.clock() - shot.started) / 1.3, 0, 1)
		if workspace.CurrentCamera ~= camera or progress >= 1 then finishCinematic() return end
		local strength = math.sin(progress * math.pi) ^ 2
		camera.CFrame = shot.frame:Lerp(target, strength * 0.7)
		camera.FieldOfView = shot.fov - 5 * strength
	end)
end
local rarityPalettes = {
	Common = {Color3.fromRGB(255, 255, 255), Color3.fromRGB(183, 198, 216)},
	Uncommon = {Color3.fromRGB(210, 255, 122), Color3.fromRGB(48, 207, 85)},
	Rare = {Color3.fromRGB(116, 234, 255), Color3.fromRGB(58, 118, 255)},
	Epic = {Color3.fromRGB(244, 137, 255), Color3.fromRGB(156, 48, 255)},
	Legendary = {Color3.fromRGB(255, 248, 141), Color3.fromRGB(255, 145, 33)},
	Mythic = {Color3.fromRGB(255, 145, 178), Color3.fromRGB(235, 40, 77)},
	Secret = {Color3.fromRGB(126, 255, 238), Color3.fromRGB(197, 94, 255)},
}
local rarityVFXColors = {
	Common = Color3.fromRGB(155, 165, 180),
	Uncommon = Color3.fromRGB(70, 225, 95),
	Rare = Color3.fromRGB(70, 165, 255),
	Epic = Color3.fromRGB(190, 75, 255),
	Legendary = Color3.fromRGB(255, 190, 50),
	Mythic = Color3.fromRGB(255, 65, 105),
	Secret = Color3.fromRGB(100, 255, 230),
}

local function oddsText(value)
	if not value then return "" end
	local number = value < 100 and string.format("%.1f", value) or tostring(math.floor(value + 0.5))
	number = number:gsub("%.0$", "")
	return "1 in " .. number
end

local function easeOut(t)
	return 1 - (1 - math.clamp(t, 0, 1)) ^ 3
end

local function burst(center, color, kind)
	for i = 1, 12 do
		local angle = i * math.pi * 2 / 12
		local direction = Vector3.new(math.cos(angle), random:NextNumber(-0.15, 0.65), math.sin(angle)).Unit
		local spark = Instance.new("Part")
		spark.Name = (kind or "Reveal") .. "Spark"
		spark.Size = Vector3.new(0.075, 0.075, 0.32)
		spark.Color = color or (i % 3 == 0 and Color3.fromRGB(255, 219, 137) or Color3.new(1, 1, 1))
		spark.Material = Enum.Material.Neon
		spark.Anchored = true
		spark.CanCollide, spark.CanTouch, spark.CanQuery = false, false, false
		spark.CastShadow = false
		spark.CFrame = CFrame.lookAt(center + direction * 1.8, center + direction * 3)
		spark.Parent = visuals
		TweenService:Create(spark, TweenInfo.new(0.55, Enum.EasingStyle.Quart, Enum.EasingDirection.Out), {
			CFrame = CFrame.lookAt(center + direction * random:NextNumber(3.4, 4.4), center + direction * 6),
			Transparency = 1, Size = Vector3.new(0.02, 0.02, 0.08),
		}):Play()
		Debris:AddItem(spark, 0.6)
	end
end

local function shockwave(center, color, kind)
	local ring = Instance.new("Model")
	ring.Name = (kind or "Reveal") .. "Shockwave"
	for i = 1, 24 do
		local angle = i * math.pi * 2 / 24
		local tangent = Instance.new("Part")
		tangent.Size = Vector3.new(0.045, 0.045, 0.43)
		tangent.Color = color or Color3.fromRGB(255, 240, 195)
		tangent.Material = Enum.Material.Neon
		tangent.Anchored = true
		tangent.CanCollide, tangent.CanTouch, tangent.CanQuery = false, false, false
		tangent.CastShadow = false
		local radial = Vector3.new(math.cos(angle), 0, math.sin(angle))
		local forward = Vector3.new(-math.sin(angle), 0, math.cos(angle))
		tangent.CFrame = CFrame.lookAt(center + radial * 1.65, center + radial * 1.65 + forward)
		tangent.Parent = ring
		TweenService:Create(tangent, TweenInfo.new(0.5, Enum.EasingStyle.Quart, Enum.EasingDirection.Out), {
			CFrame = CFrame.lookAt(center + radial * 3.8, center + radial * 3.8 + forward),
			Size = Vector3.new(0.015, 0.015, 1), Transparency = 1,
		}):Play()
	end
	ring.Parent = visuals
	Debris:AddItem(ring, 0.6)
end

local function restore(state)
	if cinematic and cinematic.state == state then finishCinematic() end
	if state.tick then state.tick:Stop() end
	if state.revealSound then state.revealSound:Stop() end
	if state.item then state.item:Destroy() end
	for _, ghost in state.ghosts do ghost.model:Destroy() end
	for _, orbit in state.orbits do orbit:Destroy() end
	for part, value in state.transparencies do
		if part.Parent then part.LocalTransparencyModifier = value end
	end
	for object, value in state.enabled do
		if object.Parent then object.Enabled = value end
	end
	if state.display.Parent then state.display:SetAttribute("HiddenForRoll", nil) end
end

local function showItem(state, template, now, final)
	if state.item and not final then
		state.item:Destroy()
	elseif state.item then
		local parts = {}
		for _, part in state.item:GetDescendants() do
			if part:IsA("BasePart") then table.insert(parts, part) end
		end
		table.insert(state.ghosts, {model = state.item, frame = state.item:GetPivot(),
			started = now, parts = parts, outline = state.outline, label = state.label})
	end
	local clone = template:Clone()
	local model = Instance.new("Model")
	model.Name = final and "FinalPart" or "RollingPart"
	clone.Parent = model
	for _, object in model:GetDescendants() do
		if object:IsA("BaseScript") or object:IsA("Highlight")
			or (not final and (object:IsA("SurfaceAppearance") or object:IsA("Decal") or object:IsA("Texture")))
			or object:IsA("ProximityPrompt")
			or object:IsA("BillboardGui") or object:IsA("SurfaceGui")
			or object:IsA("ParticleEmitter") or object:IsA("Trail")
			or object:IsA("Beam") or object:IsA("Light") or object:IsA("Sound") then
			object:Destroy()
		elseif object:IsA("BasePart") then
			object.Anchored = true
			object.CanCollide, object.CanTouch, object.CanQuery = false, false, false
			if not final then
				object.Color = Color3.new(0, 0, 0)
				object.Material = Enum.Material.SmoothPlastic
				object.Transparency, object.Reflectance = 0, 0
				if object:IsA("MeshPart") then object.TextureID = "" end
			end
		elseif object:IsA("SpecialMesh") and not final then object.TextureId = "" end
	end
	local box, size = model:GetBoundingBox()
	-- Imported primary-part pivots can be tilted; keep the authored world-up geometry.
	model.WorldPivot = CFrame.new(box.Position)
	box, size = model:GetBoundingBox()
	local longest = math.max(size.X, size.Y, size.Z)
	model:ScaleTo(model:GetScale() * (final and 2 or 4.8 / math.max(longest, 0.01)))
	box, size = model:GetBoundingBox()
	state.centerOffset = model:GetPivot():ToObjectSpace(box)
	state.halfSize = size * 0.5
	state.baseScale = model:GetScale()
	local outline = Instance.new("Highlight")
	outline.Name = "PartOutline"
	outline.Adornee = model
	outline.DepthMode = Enum.HighlightDepthMode.Occluded
	outline.FillColor, outline.OutlineColor = Color3.new(0, 0, 0), Color3.new(1, 1, 1)
	outline.FillTransparency, outline.OutlineTransparency = final and 1 or 0, 0
	outline.Parent = model
	local labelGui = Instance.new("BillboardGui")
	labelGui.Name = "ItemLabel"
	labelGui.Size = UDim2.fromOffset(300, final and 128 or 92)
	-- Keep the entire label above its anchor instead of centering it over the item.
	labelGui.SizeOffset = Vector2.new(0, 0.5)
	labelGui.MaxDistance = 65
	labelGui.AlwaysOnTop = true
	labelGui.Enabled = false
	labelGui.LightInfluence = 0
	local labelPart = model:FindFirstChildWhichIsA("BasePart", true)
	local labelAnchor = Instance.new("Attachment")
	labelAnchor.Name = "ItemLabelAnchor"
	labelAnchor.Parent = labelPart
	labelGui.Adornee = labelAnchor
	labelGui.Parent = model
	local label = Instance.new("TextLabel")
	label.Name = "ItemName"
	label.Size = UDim2.new(1, 0, 0, 30)
	label.BackgroundTransparency = 1
	label.Text = final and (displayNames[template] or template.Name) or "???"
	if final and template.Parent.Name == "blocks" then label.Text = "5× " .. label.Text end
	label.FontFace = Font.new("rbxasset://fonts/families/Montserrat.json", Enum.FontWeight.Heavy)
	label.TextSize = 24
	label.TextColor3 = Color3.new(1, 1, 1)
	label.TextStrokeColor3 = Color3.fromRGB(20, 20, 24)
	label.TextStrokeTransparency = 1
	label.TextTransparency = 1
	label.Parent = labelGui
	local textOutline = Instance.new("UIStroke")
	textOutline.Name = "TextOutline"
	textOutline.ApplyStrokeMode = Enum.ApplyStrokeMode.Contextual
	textOutline.Color = Color3.fromRGB(12, 12, 16)
	textOutline.Thickness = 3
	textOutline.Transparency = 1
	textOutline.Parent = label
	local chance = label:Clone()
	chance.Name = "Odds"
	chance.Position = UDim2.fromOffset(0, 31)
	chance.Size = UDim2.new(1, 0, 0, 32)
	chance.TextSize = 28
	chance.TextColor3 = Color3.new(1, 1, 1)
	chance.Text = oddsText(template:GetAttribute("Odds"))
	chance.Parent = labelGui
	local rarity = label:Clone()
	rarity.Name = "Rarity"
	rarity.Position = UDim2.fromOffset(0, 63)
	rarity.Text = final and (template:GetAttribute("Rarity") or "Common") or "???"
	rarity.TextSize = 21
	rarity.TextColor3 = Color3.new(1, 1, 1)
	rarity.Parent = labelGui
	local price = label:Clone()
	price.Name = "Price"
	price.Position = UDim2.fromOffset(0, 94)
	price.Size = UDim2.new(1, 0, 0, 32)
	price.TextSize = 28
	price.TextColor3 = Color3.new(1, 1, 1)
	price.Text = "$" .. tostring(template:GetAttribute("Price") or 0)
	price.Visible = final
	price.Parent = labelGui
	local priceGradient = Instance.new("UIGradient")
	priceGradient.Rotation = 90
	priceGradient.Color = ColorSequence.new(Color3.fromRGB(201, 255, 99), Color3.fromRGB(73, 195, 0))
	priceGradient.Parent = price
	local palette = rarityPalettes[template:GetAttribute("Rarity")] or rarityPalettes.Common
	for _, row in {chance, rarity} do
		local gradient = Instance.new("UIGradient")
		gradient.Rotation = 90
		gradient.Color = ColorSequence.new({
			ColorSequenceKeypoint.new(0, palette[1]), ColorSequenceKeypoint.new(0.45, palette[1]),
			ColorSequenceKeypoint.new(1, palette[2]),
		})
		gradient.Parent = row
	end
	model:SetAttribute("SourceCategory", template.Parent.Name)
	model:SetAttribute("SourceItem", template.Name)
	model:SetAttribute("FullColorReveal", final)
	model.Parent = visuals
	state.outline = outline
	state.label, state.labelGui = label, labelGui
	state.labelAnchor = labelAnchor
	state.textOutline = textOutline
	state.labelRows = {label, chance, rarity, price}
	state.priceLabel = price
	state.rarity = template:GetAttribute("Rarity") or "Common"
	state.vfxColor = rarityVFXColors[state.rarity] or rarityVFXColors.Common
	state.item, state.itemStarted, state.final = model, now, final
	if final then
		state.tick:Stop()
		for effect, enabled in state.effects do
			if effect.Parent then effect.Enabled = enabled end
		end
		local resultOdds = template:GetAttribute("Odds") or 0
		if resultOdds >= 500 then
			state.revealSound:Stop()
			state.revealSound.TimePosition = 0
			state.revealSound:Play()
			state.revealSound:SetAttribute("RevealRarity", state.rarity)
			state.revealSound:SetAttribute("RevealOdds", resultOdds)
			playCinematic(state)
		end
		for _, orbit in state.orbits do orbit:Destroy() end
		table.clear(state.orbits)
		burst(state.center, state.vfxColor)
		shockwave(state.center, state.vfxColor)
	end
	state.switches += 1
	visuals:SetAttribute("ItemsShown", state.switches)
	if not final then
		state.tickGeneration = (state.tickGeneration or 0) + 1
		local generation = state.tickGeneration
		state.tick:Stop()
		state.tick.TimePosition = 0
		state.tick.PlaybackSpeed = 1
		state.tick:Play()
		state.tick:SetAttribute("TicksPlayed", state.switches)
		task.delay(0.095, function()
			if state.tick.Parent and state.tickGeneration == generation then state.tick:Stop() end
		end)
	end
end

local function start(spinner)
	if active[spinner] then restore(active[spinner]) active[spinner] = nil end
	local reference = spinner:FindFirstChild("RollDisplay")
	local display = reference and reference.Value
	if not display or not display:IsA("Model") or #pool == 0 then return end
	local started = spinner:GetAttribute("RollStartedAt")
	local duration = spinner:GetAttribute("RollDuration")
	if not started or not duration then return end
	if not centers[display] then
		local body = display:FindFirstChild("parts", true)
		local box = display:GetBoundingBox()
		centers[display] = body and body:IsA("BasePart") and body.Position or box.Position
	end
	local state = {display = display, center = centers[display], started = started,
		duration = duration, nextSwitch = 0, switches = 0, transparencies = {}, enabled = {}, effects = {}, ghosts = {}, orbits = {}}
	local tick = spinner:FindFirstChild("ItemRollTick") or Instance.new("Sound")
	tick.Name = "ItemRollTick"
	tick.SoundId = "rbxassetid://137872392480008"
	tick.Volume = 1.2
	tick.RollOffMinDistance, tick.RollOffMaxDistance = 8, 65
	tick.Looped = false
	tick.Parent = spinner
	state.tick = tick
	local revealSound = spinner:FindFirstChild("RareRevealSound") or Instance.new("Sound")
	revealSound.Name = "RareRevealSound"
	revealSound.SoundId = "rbxassetid://138826200740867"
	revealSound.Volume = 0.65
	revealSound.Looped = false
	revealSound.RollOffMinDistance, revealSound.RollOffMaxDistance = 8, 65
	revealSound.Parent = spinner
	state.revealSound = revealSound
	local camera = workspace.CurrentCamera
	local direction = camera and Vector3.new(camera.CFrame.Position.X, state.center.Y, camera.CFrame.Position.Z)
	state.facing = direction and (direction - state.center).Magnitude > 0.01
		and CFrame.lookAt(state.center, direction).Rotation or CFrame.identity
	display:SetAttribute("HiddenForRoll", true)
	for _, object in display:GetDescendants() do
		if object:IsA("BasePart") then
			state.transparencies[object] = object.LocalTransparencyModifier
			object.LocalTransparencyModifier = 1
		elseif object:IsA("Highlight") or object:IsA("BillboardGui") or object:IsA("SurfaceGui") then
			state.enabled[object] = object.Enabled
			object.Enabled = false
		elseif object:IsA("ParticleEmitter") or object:IsA("Beam") or object:IsA("Trail") or object:IsA("Light") then
			state.enabled[object] = object.Enabled
			state.effects[object] = object.Enabled
			object.Enabled = false
			if object:IsA("ParticleEmitter") or object:IsA("Trail") then object:Clear() end
		end
	end
	active[spinner] = state
end

local function watch(spinner)
	if watched[spinner] then return end
	local reference = spinner:FindFirstChild("RollDisplay")
	if not reference then return end
	watched[spinner] = spinner:GetAttributeChangedSignal("Rolling"):Connect(function()
		if spinner:GetAttribute("Rolling") then start(spinner) end
	end)
	if spinner:GetAttribute("Rolling") then start(spinner) end
end
CollectionService:GetInstanceAddedSignal("AnimatedRollLever"):Connect(watch)
CollectionService:GetInstanceRemovedSignal("AnimatedRollLever"):Connect(function(spinner)
	if active[spinner] then restore(active[spinner]) active[spinner] = nil end
	if watched[spinner] then watched[spinner]:Disconnect() watched[spinner] = nil end
end)
for _, spinner in CollectionService:GetTagged("AnimatedRollLever") do watch(spinner) end

RunService.RenderStepped:Connect(function()
	local now = workspace:GetServerTimeNow()
	for spinner, state in active do
		local elapsed = now - state.started
		local purchaseFinished = state.purchaseStarted and now - state.purchaseStarted >= 0.85
		if not spinner.Parent or not state.display.Parent or purchaseFinished then
			restore(state)
			active[spinner] = nil
		else
			local finalAt = state.duration
			if not state.final then
				local buildup = math.clamp(elapsed / finalAt, 0, 1)
				local angle = elapsed * 12 - buildup ^ 3 * 5
				local radius = 2.9 - 0.8 * buildup ^ 4
				for i, orbit in state.orbits do
					local theta = angle + i * math.pi * 0.5
					local pos = state.center + Vector3.new(math.cos(theta) * radius, 0, math.sin(theta) * radius)
					orbit.CFrame = CFrame.lookAt(pos, pos + Vector3.new(-math.sin(theta), 0, math.cos(theta)))
					orbit.Transparency = 0.2 + 0.3 * (1 - buildup)
				end
			end
			if elapsed >= finalAt and not state.final then
				local result = spinner:FindFirstChild("RollResult")
				showItem(state, result and result.Value or pool[random:NextInteger(1, #pool)], now, true)
			elseif not state.final and elapsed >= state.nextSwitch and elapsed < finalAt - 0.28 then
				local bucket = categories[(state.switches % #categories) + 1]
				local template = bucket[random:NextInteger(1, #bucket)]
				state.previous = template
				showItem(state, template, now, false)
				local progress = math.clamp(elapsed / finalAt, 0, 1)
				state.interval = 0.10 + 0.16 * progress ^ 3
				state.nextSwitch = elapsed + state.interval
			end
			if state.item then
				if state.final and spinner:GetAttribute("Purchased") and not state.purchasePlayed then
					state.purchasePlayed = true
					state.purchaseStarted = now
					state.item:SetAttribute("PurchaseVFXRarity", state.rarity)
					state.item:SetAttribute("PurchaseVFXColor", state.vfxColor)
					burst(state.center, state.vfxColor, "Purchase")
					shockwave(state.center, state.vfxColor, "Purchase")
				end
				local age = now - state.itemStarted
				local progress = math.clamp(age / (state.final and 0.75 or state.interval), 0, 1)
				local enter = easeOut(progress)
				local anticipation = not state.final and math.clamp((elapsed - (finalAt - 0.28)) / 0.28, 0, 1) or 0
				local size = state.final
					and math.min(1, 1 - 0.62 * math.exp(-age * 8) * math.cos(age * 15))
					or (0.62 + 0.38 * easeOut(age / math.min(0.14, state.interval * 0.85)))
				local purchaseAge = state.purchaseStarted and (now - state.purchaseStarted) or math.huge
				if purchaseAge < 0.85 then
					size *= 1 + 0.16 * math.sin(math.clamp(purchaseAge / 0.6, 0, 1) * math.pi)
				end
				local targetScale = state.baseScale * size
				if math.abs(state.item:GetScale() - targetScale) > 0.0001 then state.item:ScaleTo(targetScale) end
				local slide = 0
				local yaw = state.final and (math.rad(-280) * (1 - enter) + math.rad(18) * math.sin(age * 0.55) * enter)
					or 0
				if purchaseAge < 0.85 then yaw += math.pi * 2 * easeOut(purchaseAge / 0.85) end
				local tilt = state.final and math.rad(14) * math.exp(-age * 5) * math.sin(age * 14)
					or 0
				local pose = CFrame.new(state.center) * state.facing
				local itemFrame = pose * CFrame.new(slide, 0, 0) * CFrame.Angles(tilt, yaw, 0)
				local centerOffset = CFrame.new(state.centerOffset.Position * size) * state.centerOffset.Rotation
				state.item:PivotTo(itemFrame * centerOffset:Inverse())
				state.item:SetAttribute("DisplayCenter", state.center)
				local half = state.halfSize * size
				local top = math.abs(itemFrame.RightVector.Y) * half.X
					+ math.abs(itemFrame.UpVector.Y) * half.Y + math.abs(itemFrame.LookVector.Y) * half.Z
				local labelPosition = itemFrame.Position + Vector3.new(0, top + 1.65, 0)
				state.labelAnchor.Position = state.labelAnchor.Parent.CFrame:PointToObjectSpace(labelPosition)
				state.labelGui.Enabled = true
				local opacity = 1 - easeOut(age / (state.final and 0.2 or 0.045))
				for _, row in state.labelRows do
					row.TextTransparency = opacity
					row.TextOutline.Transparency = opacity
				end
				if state.final and spinner:GetAttribute("Purchased") then state.priceLabel.Text = "Purchased" end
				if state.final then
					state.outline.OutlineColor = state.vfxColor:Lerp(Color3.new(1, 1, 1), math.clamp(purchaseAge / 0.85, 0, 1))
					state.outline.OutlineTransparency = 0.18 * easeOut(age / 0.7)
					state.outline.FillTransparency = 1
				end
			end
			for i = #state.ghosts, 1, -1 do
				local ghost = state.ghosts[i]
				local t = math.clamp((now - ghost.started) / 0.16, 0, 1)
				if t >= 1 then
					ghost.model:Destroy()
					table.remove(state.ghosts, i)
				else
					ghost.model:PivotTo(ghost.frame)
					for _, part in ghost.parts do part.LocalTransparencyModifier = t end
					ghost.outline.OutlineTransparency = t
					ghost.outline.FillTransparency = t
					for _, row in ghost.label.Parent:GetChildren() do
						if row:IsA("TextLabel") then row.TextTransparency = t row.TextOutline.Transparency = t end
					end
				end
			end
		end
	end
end)
