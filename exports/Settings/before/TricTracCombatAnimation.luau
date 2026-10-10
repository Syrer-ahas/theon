local CollectionService=game:GetService("CollectionService")
local RunService=game:GetService("RunService")
local TAG="TricTracCombat"
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
 {t=.23,v={5,-.07,-.10,-3,0,-16,0,.13,0,8,0,0}},
 {t=.35,v={7,-.10,-.12,-5,0,-24,0,.19,0,12,0,0}},
 {t=.42,v={-6,.19,.035,4,0,28,.05,.04,0,-24,0,0},ease="out"},
 {t=.48,v={-6,.19,.01,4,0,12,.03,0,0,-24,0,0}},
 {t=.64,v={2,.06,-.025,1,0,3,0,0,0,5,0,0}},
 {t=.83,v={0,0,0,0,0,0,0,0,0,-2,0,0}},
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
   local cycle=math.clamp(model:GetAttribute("PunchCycleSeconds") or 1.25,1,2)
   local elapsed=now-(model:GetAttribute("PunchStartedAt") or 0)
   local p=(elapsed%cycle)/cycle
   local v=sample(p)
   local side=math.floor(elapsed/cycle)%2==0 and 1 or -1
   local j=rig.joints
   pose(j.Bone,mix(2,v[1],blend),v[2]*blend,
    mix(.045*(1-math.cos(phase*2)),v[3],blend),1*step*(1-blend),v[4]*side*blend)
   local active=side==1 and "Bone.002" or "Bone.004"
   local support=side==1 and "Bone.004" or "Bone.002"
   local foot=side==1 and "Bone.003" or "Bone.005"
   local supportFoot=side==1 and "Bone.005" or "Bone.003"
   local stride=side==1 and step or -step
   pose(j[active],mix(23*stride,v[6],blend),v[7]*blend,v[8]*blend)
   pose(j[support],-23*stride*(1-blend))
   plant(j.Bone,j[support],blend)
   pose(j[foot],mix(-9*stride,-v[6]*.45,blend))
   pose(j[supportFoot],9*stride*(1-blend))
   -- The head snaps forward as the lifted foot plants; the tail lags behind.
   pose(j["Bone.001"],mix(-1.2*math.sin(phase*2),v[10],blend),
    .04*math.max(0,-v[10]/24)*blend,0,0,-v[4]*side*blend*.5)
   local tail=math.sin(p*math.pi*2-.8)*math.max(0,-v[10]/24)
   pose(j["Bone.006"],mix(1.2*step,2*tail,blend),0,0,0,mix(4*step,-6*tail,blend))
  end
 end
end)
