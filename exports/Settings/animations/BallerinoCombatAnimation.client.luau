local AnimationBudget=require(game:GetService('ReplicatedStorage'):WaitForChild('PerformanceAnimationBudget'))
local CollectionService=game:GetService("CollectionService")
local RunService=game:GetService("RunService")
local TAG="BallerinoCombat"
local rigs={}
local pending={}
local names={"Bone","Bone.001","Bone.002","Bone.003","Bone.004","Bone.005","Bone.006","Bone.007","Bone.008","Bone.009","Bone.010","Bone.011","Bone.012"}
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
   local cycle=math.clamp(model:GetAttribute("PunchCycleSeconds") or 1.15,.8,2)
   local p=((now-(model:GetAttribute("PunchStartedAt") or 0))%cycle)/cycle
   local lw,le,lh=strike(p/.4)
   local rw,re,rh=strike((p-.45)/.5)
   local wind=lw+rw
   local extension=le+re
   local yaw=(-13*le+23*re+6*lw-10*rw)*blend
   local lean=-3-3*extension+2*wind
   local j=rig.joints
   -- Light, deliberate footwork gives the dancer an upright silhouette.
   pose(j.Bone,mix(1.5,lean,blend),.07*extension*blend,
    mix(.04*(1-math.cos(phase*2)),-.04*wind,blend),
    mix(1.5*step,-2*le+3*re,blend),yaw,(-.05*le+.07*re)*blend)
   for _,side in {"L","R"} do
    local sign=side=="L" and 1 or -1
    local stride=step*sign
    local lift=side=="L" and leftLift or rightLift
    local hip=side=="L" and "Bone.007" or "Bone.010"
    local knee=side=="L" and "Bone.008" or "Bone.011"
    local foot=side=="L" and "Bone.009" or "Bone.012"
    pose(j[hip],mix(25*stride,-lean+sign*3,blend),0,0,0,-yaw*.8)
    pose(j[knee],mix(-6-27*lift,-9-3*wind,blend))
    pose(j[foot],mix(-10*stride+8*lift,4+3*extension,blend))
   end
   -- Convert the imported outstretched arms into a guard before striking.
   pose(j["Bone.005"],mix(-15*step,32+47*le-10*lw+4*re,blend),
    0,0,mix(-76,-58-5*le,blend),-5*le*blend)
   pose(j["Bone.003"],mix(15*step,34+52*re-12*rw+4*le,blend),
    0,0,mix(76,58+7*re,blend),8*re*blend)
   pose(j["Bone.006"],mix(0,-4*le,blend),0,0,mix(7,96-83*le+8*lw,blend))
   pose(j["Bone.004"],mix(0,-5*re,blend),0,0,mix(-7,-96+83*re-8*rw,blend))
   -- Keep the head aimed at the player through the shoulder turn.
   pose(j["Bone.001"],mix(-1.5*math.sin(phase*2),-3-3*wind+2*extension,blend),0,0,0,-yaw*.7)
   pose(j["Bone.002"],mix(1.5*step,2*(lh+rh),blend))
  end
 end
end)
