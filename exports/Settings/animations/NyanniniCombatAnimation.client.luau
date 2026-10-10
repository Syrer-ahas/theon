local AnimationBudget=require(game:GetService('ReplicatedStorage'):WaitForChild('PerformanceAnimationBudget'))
local CollectionService=game:GetService("CollectionService")
local RunService=game:GetService("RunService")
local TAG="NyanniniCombat"
local rigs={}
local pending={}
local names={"Bone","Bone.001","Bone.002","Bone.003","Bone.004","Bone.005","Bone.006"}
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
local frames={
 {t=0,v={0,0,0,0,0,0,0,0,0,0,0,0}},
 {t=.22,v={4,-.09,-.14,-4,-2,-18,-.02,.15,-5,-6,-3,0}},
 {t=.34,v={6,-.11,-.16,-6,-2,-32,-.03,.22,-8,-8,-5,2}},
 {t=.40,v={-5,.28,.06,10,2,48,.12,.12,14,-4,-9,-3},ease="out"},
 {t=.45,v={-5,.28,.06,10,2,48,.12,.12,14,-4,-9,-3}},
 {t=.60,v={2,.12,-.06,4,1,12,0,.02,3,2,-4,0}},
 {t=.78,v={-1,.02,-.02,0,0,0,0,0,0,-1,0,0}},
 {t=1,v={0,0,0,0,0,0,0,0,0,0,0,0}}
}
local function sample(p)
 for i=2,#frames do
  local nextFrame=frames[i]
  if p<=nextFrame.t then
   local previous=frames[i-1]
   local t=(p-previous.t)/(nextFrame.t-previous.t)
   t=nextFrame.ease=="out" and (1-(1-t)^3) or smooth(t)
   local result={}
   for k,value in previous.v do result[k]=mix(value,nextFrame.v[k],t) end
   return result
  end
 end
 return frames[#frames].v
end
local function plant(root,j,blend)
 -- Counter the torso movement at a supporting limb's attachment.
 local delta=root.rest:Inverse()*root.bone.Transform
 local cf=j.bone.CFrame
 local original=j.bone.Transform
 local corrected=cf:Inverse()*delta:Inverse()*cf*original
 j.bone.Transform=original:Lerp(corrected,blend)
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
   local cycle=math.clamp(model:GetAttribute("PunchCycleSeconds") or 1.35,1,2)
   local elapsed=now-(model:GetAttribute("PunchStartedAt") or 0)
   local p=(elapsed%cycle)/cycle
   local v=sample(p)
   local side=math.floor(elapsed/cycle)%2==0 and 1 or -1
   local j=rig.joints
   pose(j.Bone,mix(1.5*math.sin(phase*2),v[1],blend),v[2]*blend,
    mix(.035*(1-math.cos(phase*2)),v[3],blend),
    mix(1*step,v[5]*side,blend),v[4]*side*blend)
   local paw=side==1 and "Bone.003" or "Bone.005"
   local other=side==1 and "Bone.005" or "Bone.003"
   local pawStep=side==1 and step or -step
   pose(j[paw],mix(23*pawStep,v[6],blend),v[7]*blend,
    mix(.035*(side==1 and leftLift or rightLift),v[8],blend),v[9]*side*blend)
   pose(j[other],mix(-23*pawStep,v[12],blend),0,
    .035*(side==1 and rightLift or leftLift)*(1-blend))
   pose(j["Bone.004"],-23*step*(1-blend),0,.035*rightLift*(1-blend))
   pose(j["Bone.006"],23*step*(1-blend),0,.035*leftLift*(1-blend))
   plant(j.Bone,j["Bone.004"],blend)
   plant(j.Bone,j["Bone.006"],blend)
   plant(j.Bone,j[other],blend)
   pose(j["Bone.001"],mix(-1*math.sin(phase*2),v[10],blend),0,0,0,-v[4]*side*blend*.65)
   pose(j["Bone.002"],v[11]*blend)
  end
 end
end)
