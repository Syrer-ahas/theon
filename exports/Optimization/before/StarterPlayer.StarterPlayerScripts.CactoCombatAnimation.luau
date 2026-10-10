local CollectionService=game:GetService("CollectionService")
local RunService=game:GetService("RunService")
local TAG="CactoCombat"
local rigs={}
local pending={}
local names={"Bone","Bone.001","Bone.002","Bone.005","Bone.006","Bone.007","Bone.008"}
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
   local p=((now-(model:GetAttribute("PunchStartedAt") or 0))%
    (model:GetAttribute("PunchCycleSeconds") or .3))/(model:GetAttribute("PunchCycleSeconds") or .3)
   local jab=pulse(p)
   local recover=math.sin(p*math.pi*2)
   local j=rig.joints
   pose(j.Bone,mix(3,4-7*jab,blend),.22*jab*blend,
    mix(.045*(1-math.cos(phase*2)),.015*(1-math.cos(p*math.pi*2)),blend),2*step*(1-blend))
   pose(j["Bone.007"],mix(23*step,5+3*recover,blend),
    0,.075*math.max(0,math.cos(phase))*(1-blend))
   pose(j["Bone.008"],mix(-23*step,-5-3*recover,blend),
    0,.075*math.max(0,-math.cos(phase))*(1-blend))
   pose(j["Bone.001"],mix(-2+2*math.sin(phase*2),-3+15*jab,blend),.07*jab*blend)
   pose(j["Bone.002"],mix(1.5*math.sin(phase*2),4*jab,blend))
   pose(j["Bone.005"],mix(2*step,3*recover,blend))
   pose(j["Bone.006"],mix(-2*step,-3*recover,blend))
  end
 end
end)
