local AnimationBudget=require(game:GetService('ReplicatedStorage'):WaitForChild('PerformanceAnimationBudget'))
local CollectionService=game:GetService("CollectionService")
local RunService=game:GetService("RunService")
local TAG="BobritoCombat"
local rigs={}
local pending={}
local names={"Bone","Bone.001","Bone.002","Bone.003","Bone.004","Bone.005","Bone.006","Bone.007","Bone.008","Bone.009","Bone.010","Bone.011","Bone.012","Bone.013","Bone.014","Bone.015","Bone.016","Bone.017","Bone.018"}
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
  local frameDt=dt
  if model:IsDescendantOf(workspace) and rig.mesh.Parent and model:GetAttribute("BrainrotDistanceHidden")~=true then
   local animate,budgetDt=AnimationBudget.Step(rig,rig.mesh.Position,frameDt,camera,false)
   if not animate then continue end
   frameDt=budgetDt
  end
  if not model:IsDescendantOf(workspace) or not rig.mesh.Parent then
   reset(rig);rigs[model]=nil
  elseif model:GetAttribute("BrainrotDistanceHidden")==true or model:GetAttribute("WalkEnabled")==false or model:GetAttribute("PatapimState")=="Idle"
   or not camera or (camera.CFrame.Position-rig.mesh.Position).Magnitude>200 then
   if rig.active then reset(rig) end
  else
   rig.active=true
   local attacking=model:GetAttribute("PatapimState")=="Punch"
   rig.blend=mix(rig.blend,attacking and 1 or 0,1-math.exp(-frameDt/.07))
   local blend=rig.blend
   local phase=now/math.clamp(model:GetAttribute("WalkCycleSeconds") or .4,.25,2)*math.pi*2
   local step=math.sin(phase)
   local leftLift=math.max(0,math.cos(phase))
   local rightLift=math.max(0,-math.cos(phase))
   local cycle=math.clamp(model:GetAttribute("PunchCycleSeconds") or 1.1,.8,2)
   local p=((now-(model:GetAttribute("PunchStartedAt") or 0))%cycle)/cycle
   local lw,le,lh=strike(p/.4)
   local rw,re,rh=strike((p-.45)/.49)
   local wind=lw+rw
   local drive=le+re
   local hit=lh+rh
   local yaw=(-15*le+21*re+7*lw-9*rw)*blend
   local lean=-3-4*drive+2*wind
   local j=rig.joints
   -- Low, confident footwork with a slight shoulder swagger.
   pose(j.Bone,mix(2,lean,blend),.075*drive*blend,
    mix(.035*(1-math.cos(phase*2)),-.045*wind+.015*hit,blend),
    mix(1.2*step,0,blend),yaw,(-.055*le+.075*re)*blend)
   for _,side in {"L","R"} do
    local sign=side=="L" and 1 or -1
    local stride=step*sign
    local lift=side=="L" and leftLift or rightLift
    local hip=side=="L" and "Bone.001" or "Bone.004"
    local knee=side=="L" and "Bone.002" or "Bone.005"
    local foot=side=="L" and "Bone.003" or "Bone.006"
    pose(j[hip],mix(25*stride,-lean+sign*3,blend),0,0,0,-yaw*.85)
    pose(j[knee],mix(-5-27*lift,-9-4*wind,blend))
    pose(j[foot],mix(-10*stride+7*lift,3+3*drive,blend))
   end
   -- Compact left strike, heavier right cross; the free hand holds its guard.
   pose(j["Bone.007"],mix(-18*step,33+53*le-8*lw+3*re,blend),
    0,0,mix(-78,-78,blend),-2*le*blend)
   pose(j["Bone.010"],mix(18*step,35+55*re-9*rw+3*le,blend),
    0,0,mix(78,78,blend),3*re*blend)
   pose(j["Bone.008"],mix(0,-3*le,blend),0,0,mix(8,108-98*le+4*lw,blend))
   pose(j["Bone.011"],mix(0,-4*re,blend),0,0,mix(-8,-108+98*re-4*rw,blend))
   pose(j["Bone.009"],mix(0,-6+7*le,blend),0,0,0)
   pose(j["Bone.012"],mix(0,-6+9*re,blend),0,0,0)
   -- The face stays aimed at the target; hat and jaw settle after impact.
   pose(j["Bone.013"],mix(-1.2*math.sin(phase*2),-4-2*wind+2*drive,blend),0,0,0,-yaw*.65)
   pose(j["Bone.014"],mix(0,-2*wind-3*hit,blend))
   local follow=math.sin(p*math.pi*4-.7)*drive
   pose(j["Bone.017"],mix(.6*step,.7*follow,blend),0,0,0)
   pose(j["Bone.018"],mix(-1*step,-1.5*drive,blend))
  end
 end
end)
