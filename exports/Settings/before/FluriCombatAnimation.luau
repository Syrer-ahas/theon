local CollectionService=game:GetService("CollectionService")
local RunService=game:GetService("RunService")
local TAG="FluriCombat"
local rigs={}
local pending={}
local names={"Bone","Bone.001","Bone.002","Bone.003","Bone.004","Bone.005","Bone.006","Bone.007","Bone.008","Bone.009","Bone.010","Bone.011","Bone.012","Bone.013","Bone.014"}
local function reset(rig)
 for _,j in rig.joints do if j.bone.Parent then j.bone.Transform=j.rest end end
 rig.active=false
 rig.blend=0
end
local RigLoader = require(game:GetService("ReplicatedStorage"):WaitForChild("BrainrotRigLoader"))
local stopWatching = RigLoader.Watch(TAG, names, function(model, mesh, joints)
 rigs[model] = {mesh=mesh, joints=joints, active=false, blend=0, attackBlend=0}
end, function(model)
 local rig=rigs[model]
 if rig then reset(rig); rigs[model]=nil end
end)
script.Destroying:Connect(stopWatching)
local function mix(a,b,t) return a+(b-a)*t end
local function smooth(t)
 t=math.clamp(t,0,1)
 return t*t*(3-2*t)
end
-- Each strike has separate anticipation, extension, impact and recovery.
local function strike(t)
 if t<0 or t>1 then return 0,0,0 end
 if t<.24 then return smooth(t/.24),0,0 end
 if t<.38 then
  local q=smooth((t-.24)/.14)
  return 1-q,q,0
 end
 if t<.45 then return 0,1,1-(t-.38)/.07 end
 if t<.82 then return 0,1-smooth((t-.45)/.37),0 end
 return 0,0,0
end
local function pose(j,pitch,forward,up,roll,yaw,lateral)
 j.bone.Transform=j.rest
  *CFrame.new(j.forward*(forward or 0)+j.up*(up or 0)+j.side*(lateral or 0))
  *CFrame.fromAxisAngle(j.up,math.rad(yaw or 0))
  *CFrame.fromAxisAngle(j.side,math.rad(pitch))
  *CFrame.fromAxisAngle(j.forward,math.rad(roll or 0))
end
RunService.PreSimulation:Connect(function(dt)
 local camera=workspace.CurrentCamera
 local now=workspace:GetServerTimeNow()
 for model,rig in rigs do
  if not model:IsDescendantOf(workspace) or not rig.mesh.Parent then
   reset(rig);rigs[model]=nil
  elseif model:GetAttribute("BrainrotDistanceHidden")==true or model:GetAttribute("WalkEnabled")==false or model:GetAttribute("PatapimState")=="Idle"
   or not camera or (camera.CFrame.Position-rig.mesh.Position).Magnitude>200 then
   if rig.active then reset(rig) end
  else
   rig.active=true
   local attacking=model:GetAttribute("PatapimState")=="Punch"
   rig.blend=mix(rig.blend,attacking and 1 or 0,1-math.exp(-dt/.07))
   local blend=rig.blend
   local phase=now/math.clamp(model:GetAttribute("WalkCycleSeconds") or .4,.25,2)*math.pi*2
   local step=math.sin(phase)
   local leftLift=math.max(0,math.cos(phase))
   local rightLift=math.max(0,-math.cos(phase))
   local cycle=math.clamp(model:GetAttribute("PunchCycleSeconds") or .8,.65,2)
   local p=((now-(model:GetAttribute("PunchStartedAt") or 0))%cycle)/cycle
   local wind,drive,hit=strike(p/.88)
   local j=rig.joints
   -- Brace, pull the head back, snap the beak forward, then recover.
   -- The wings stay folded and the body has no sideways sway during the attack.
   pose(j.Bone,mix(2,-2*drive,blend),.025*drive*blend,
    mix(.035*(1-math.cos(phase*2)),-.025*wind,blend),
    1.2*step*(1-blend))
   for _,side in {"L","R"} do
    local sign=side=="L" and 1 or -1
    local stride=step*sign
    local lift=side=="L" and leftLift or rightLift
    local hip=side=="L" and "Bone.005" or "Bone.008"
    local knee=side=="L" and "Bone.006" or "Bone.009"
    local foot=side=="L" and "Bone.007" or "Bone.010"
    pose(j[hip],mix(24*stride,2*drive,blend))
    pose(j[knee],mix(-5-26*lift,-6-2*wind,blend))
    pose(j[foot],mix(-9*stride+7*lift,2,blend))
   end
   pose(j["Bone.001"],mix(-10*step,6,blend),0,0,-82)
   pose(j["Bone.003"],mix(10*step,6,blend),0,0,82)
   pose(j["Bone.002"],0,0,0,12)
   pose(j["Bone.004"],0,0,0,-12)
   -- Most of the force comes from a fast neck extension, not the wings.
   pose(j["Bone.011"],mix(-1.2*math.sin(phase*2),9*wind-25*drive,blend),
    (-.045*wind+.13*drive)*blend)
   pose(j["Bone.013"],mix(0,-3*drive,blend))
   pose(j["Bone.014"],mix(0,-2*wind+2*hit,blend))
   local follow=math.sin(p*math.pi*2-.7)*drive
   pose(j["Bone.012"],mix(.6*step,3*follow,blend))
  end
 end
end)
