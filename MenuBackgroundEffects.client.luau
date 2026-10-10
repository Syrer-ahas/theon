-- Client-only effects for the menus opened from the frontend.
local Players = game:GetService("Players")
local TweenService = game:GetService("TweenService")
local Lighting = game:GetService("Lighting")
local playerGui = Players.LocalPlayer:WaitForChild("PlayerGui")

local BLUR_SIZE = 14
local FOV_INCREASE = 8
local TRANSITION = TweenInfo.new(0.25, Enum.EasingStyle.Quint, Enum.EasingDirection.Out)
local menuNames = {
	index = true,
	plotaccess = true,
	coop = true,
	coopgui = true,
	exclusiveshop = true,
	settings = true,
	settingsgui = true,
}
local watched = {}
local hiddenGuis = {}
local active = false
local queued = false
local camera = workspace.CurrentCamera
local baseFov
local cameraTween
local blurTween

-- Lighting post effects affect the 3D world; ScreenGui artwork stays sharp.
local blur = Instance.new("BlurEffect")
blur.Name = "MenuBackgroundBlur"
blur.Size = 0
blur.Enabled = false
blur.Parent = Lighting

local function isMenu(gui)
	return menuNames[(gui.Name:lower():gsub("[%s_%-]", ""))] == true
end

local function anyMenuOpen()
	for _, gui in ipairs(playerGui:GetChildren()) do
		if gui:IsA("ScreenGui") and isMenu(gui) and gui.Enabled then
			return true
		end
	end
	return false
end

-- Remember each HUD's original state, including GUIs that were already hidden.
local function syncHudVisibility(menuOpen)
	if menuOpen then
		for _, gui in ipairs(playerGui:GetChildren()) do
			if gui:IsA("ScreenGui") and not isMenu(gui) then
				if hiddenGuis[gui] == nil then
					hiddenGuis[gui] = gui.Enabled
				end
				gui.Enabled = false
			end
		end
	else
		for gui, wasEnabled in pairs(hiddenGuis) do
			if gui.Parent == playerGui and not isMenu(gui) then
				gui.Enabled = wasEnabled
			end
		end
		table.clear(hiddenGuis)
	end
end

local function animateCamera()
	if cameraTween then
		cameraTween:Cancel()
		cameraTween = nil
	end
	if not camera then return end
	if active then
		baseFov = baseFov or camera.FieldOfView
	elseif not baseFov then
		return
	end

	local targetCamera = camera
	local originalFov = baseFov
	local target = active and math.clamp(originalFov + FOV_INCREASE, 1, 120) or originalFov
	local animation = TweenService:Create(targetCamera, TRANSITION, {FieldOfView = target})
	cameraTween = animation
	animation.Completed:Once(function(playbackState)
		if cameraTween ~= animation then return end
		cameraTween = nil
		if playbackState == Enum.PlaybackState.Completed and not active and camera == targetCamera then
			baseFov = nil
		end
	end)
	animation:Play()
end

local function updateEffects()
	queued = false
	local nowActive = anyMenuOpen()
	syncHudVisibility(nowActive)
	if nowActive == active then return end
	active = nowActive

	if blurTween then blurTween:Cancel() end
	blur.Enabled = true
	local animation = TweenService:Create(blur, TRANSITION, {Size = active and BLUR_SIZE or 0})
	blurTween = animation
	animation.Completed:Once(function(playbackState)
		if blurTween ~= animation then return end
		blurTween = nil
		if playbackState == Enum.PlaybackState.Completed and not active then
			blur.Enabled = false
		end
	end)
	animation:Play()
	animateCamera()
end

-- Coalesce menu switches so closing one and opening another keeps the effect steady.
local function scheduleUpdate()
	if queued then return end
	queued = true
	task.defer(updateEffects)
end

local function watchGui(gui)
	if not gui:IsA("ScreenGui") or watched[gui] then return end
	watched[gui] = {
		gui:GetPropertyChangedSignal("Enabled"):Connect(scheduleUpdate),
		gui:GetPropertyChangedSignal("Name"):Connect(scheduleUpdate),
	}
	scheduleUpdate()
end

playerGui.ChildAdded:Connect(watchGui)
playerGui.ChildRemoved:Connect(function(gui)
	local connections = watched[gui]
	if connections then
		for _, connection in ipairs(connections) do connection:Disconnect() end
		watched[gui] = nil
		local wasEnabled = hiddenGuis[gui]
		hiddenGuis[gui] = nil
		if wasEnabled ~= nil then gui.Enabled = wasEnabled end
		scheduleUpdate()
	end
end)

workspace:GetPropertyChangedSignal("CurrentCamera"):Connect(function()
	if cameraTween then cameraTween:Cancel(); cameraTween = nil end
	if camera and baseFov then camera.FieldOfView = baseFov end
	camera = workspace.CurrentCamera
	baseFov = nil
	animateCamera()
end)

for _, gui in ipairs(playerGui:GetChildren()) do watchGui(gui) end
scheduleUpdate()

script.Destroying:Connect(function()
	syncHudVisibility(false)
	if cameraTween then cameraTween:Cancel() end
	if blurTween then blurTween:Cancel() end
	if camera and baseFov then camera.FieldOfView = baseFov end
	blur:Destroy()
end)
