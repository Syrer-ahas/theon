local CollectionService = game:GetService("CollectionService")
local RunService = game:GetService("RunService")

local TAG = "AnimatedRollLever"
local active = {}
local watchers = {}
local renderConnection

local function smooth(t)
	t = math.clamp(t, 0, 1)
	return t * t * t * (t * (t * 6 - 15) + 10)
end

local function motion(progress, turns, pullAngle)
	if progress < 0.025 then
		return -10 * smooth(progress / 0.025), 0, 0
	elseif progress < 0.075 then
		return -10 + (pullAngle + 10) * smooth((progress - 0.025) / 0.05), 0, 0
	elseif progress < 0.09 then
		return pullAngle, 0, 0
	elseif progress < 0.145 then
		return pullAngle - (pullAngle + 13) * smooth((progress - 0.09) / 0.055), 0, 0
	elseif progress < 0.9 then
		local t = (progress - 0.145) / 0.755
		local envelope = (1 - smooth(t)) * math.exp(-2.5 * t * t)
		local recoil = -13 * envelope * math.cos(t * math.pi * 10)
		return recoil, turns * math.pi * 2 * smooth(t),
			0.09 * math.sin(t * math.pi) ^ 2
	end
	-- Hold the settled pose; no second bounce or rotation at the end.
	return 0, turns * math.pi * 2, 0
end
local function stop(spinner)
	local animation = active[spinner]
	if animation and spinner.Parent then spinner:PivotTo(animation.base) end
	active[spinner] = nil
	if not next(active) and renderConnection then
		renderConnection:Disconnect()
		renderConnection = nil
	end
end

local function start(spinner)
	local base = spinner:GetAttribute("RollBasePivot")
	local axis = spinner:GetAttribute("RollTiltAxis")
	local spinAxis = spinner:GetAttribute("RollSpinAxis") or base and base.RightVector
	local started = spinner:GetAttribute("RollStartedAt")
	local duration = spinner:GetAttribute("RollDuration")
	local turns = spinner:GetAttribute("RollTurns")
	local pullAngle = spinner:GetAttribute("RollPullAngle") or 65
	if typeof(base) ~= "CFrame" or typeof(axis) ~= "Vector3" or typeof(spinAxis) ~= "Vector3"
		or typeof(started) ~= "number" or typeof(duration) ~= "number"
		or typeof(turns) ~= "number" or duration <= 0 then return end
	active[spinner] = {base = base, axis = axis, spinAxis = spinAxis, started = started, duration = duration, turns = turns, pullAngle = pullAngle}
	if renderConnection then return end
	renderConnection = RunService.RenderStepped:Connect(function()
		local now = workspace:GetServerTimeNow()
		for part, animation in active do
			local progress = (now - animation.started) / animation.duration
			if not part.Parent or not part:GetAttribute("Rolling") or progress >= 1 then
				stop(part)
			else
				local tilt, spin, lift = motion(math.max(progress, 0), animation.turns, animation.pullAngle)
				part:PivotTo(CFrame.new(animation.base.Position + animation.spinAxis * lift)
					* CFrame.fromAxisAngle(animation.axis, math.rad(tilt))
					* CFrame.fromAxisAngle(animation.spinAxis, spin) * animation.base.Rotation)
			end
		end
	end)
end

local function watch(spinner)
	if watchers[spinner] or not spinner:IsA("BasePart") then return end
	watchers[spinner] = {
		spinner:GetAttributeChangedSignal("Rolling"):Connect(function()
			if spinner:GetAttribute("Rolling") then start(spinner) else stop(spinner) end
		end),
		spinner:GetAttributeChangedSignal("RollStartedAt"):Connect(function()
			if spinner:GetAttribute("Rolling") then start(spinner) end
		end),
	}
	if spinner:GetAttribute("Rolling") then start(spinner) end
end

CollectionService:GetInstanceAddedSignal(TAG):Connect(watch)
CollectionService:GetInstanceRemovedSignal(TAG):Connect(function(spinner)
	stop(spinner)
	local connections = watchers[spinner]
	if connections then for _, connection in connections do connection:Disconnect() end end
	watchers[spinner] = nil
end)
for _, spinner in CollectionService:GetTagged(TAG) do watch(spinner) end
