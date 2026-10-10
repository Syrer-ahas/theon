local AnimationBudget=require(game:GetService('ReplicatedStorage'):WaitForChild('PerformanceAnimationBudget'))
local CollectionService=game:GetService("CollectionService")
local RunService=game:GetService("RunService")
local TAG="GirafaCombat"
local rigs={}
local pending={}
local names={"Bone","Bone.001","Bone.002","Bone.003","Bone.008.L","Bone.009.L","Bone.010.L","Bone.008.R","Bone.009.R","Bone.010.R","Bone.011.L","Bone.012.L","Bone.013.L","Bone.011.R","Bone.012.R","Bone.013.R"}
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
local function pulse(p)
 local t=p<.22 and p/.22 or (1-p)/.78
 t=math.clamp(t,0,1)
 return t*t*(3-2*t)
end
local function pose(j,angle,forward,up,roll)
 j.bone.Transform=j.rest
  *CFrame.new(j.forward*(forward or 0)+j.up*(up or 0))
  *CFrame.fromAxisAngle(j.side,math.rad(angle))
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
   local p=((now-(model:GetAttribute("PunchStartedAt") or 0))%
    (model:GetAttribute("PunchCycleSeconds") or .3))/(model:GetAttribute("PunchCycleSeconds") or .3)
   local wind=0
   local impact=0
   if p<.22 then
    local t=p/.22
    wind=t*t*(3-2*t)
   elseif p<.38 then
    local t=(p-.22)/.16
    t=t*t*(3-2*t)
    wind=1-t
    impact=t
   else
    local t=(p-.38)/.62
    impact=1-t*t*(3-2*t)
   end
   local jab=impact-.45*wind
   local recover=math.sin(p*math.pi*2)
   local j=rig.joints
   -- Only the walking animation moves the torso.
   pose(j.Bone,1.5*math.sin(phase*2)*(1-blend),0,
    .06*(1-math.cos(phase*2))*(1-blend),1.2*step*(1-blend))
   for _,side in {"L","R"} do
    local sign=side=="L" and 1 or -1
    local stride=step*sign
    local lift=math.max(0,math.cos(phase)*sign)
    pose(j["Bone.008."..side],24*stride*(1-blend))
    pose(j["Bone.009."..side],-22*lift*(1-blend))
    pose(j["Bone.010."..side],-10*stride*(1-blend))
    pose(j["Bone.011."..side],-24*stride*(1-blend))
    pose(j["Bone.012."..side],-22*(1-lift)*(1-blend))
    pose(j["Bone.013."..side],10*stride*(1-blend))
   end
   -- Small lower-neck motion; the upper neck and head deliver the strike.
   pose(j["Bone.001"],mix(-1.5*math.sin(phase*2),-4*jab,blend))
   pose(j["Bone.002"],mix(1.5*math.sin(phase*2),-29*jab,blend))
   pose(j["Bone.003"],mix(-1*math.sin(phase*2),14*jab-4,blend))
  end
 end
end)
