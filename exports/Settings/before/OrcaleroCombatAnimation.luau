local CollectionService=game:GetService("CollectionService")
local RunService=game:GetService("RunService")
local TAG="OrcaleroCombat"
local rigs={}
local pending={}
local names={"Bone","Bone.001","Bone.003","Bone.004","Bone.005","Bone.006","Bone.007","Bone.009","Bone.010","Bone.011","Bone.012","Bone.014","Bone.015","Bone.016","Bone.018","Bone.019","Bone.020"}
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
   local cycle=math.clamp(model:GetAttribute("PunchCycleSeconds") or .95,.7,2)
   local p=((now-(model:GetAttribute("PunchStartedAt") or 0))%cycle)/cycle
   local wind,drive,impact=strike(p/.84)
   local j=rig.joints
   local bodyPitch=(3*wind-4*drive)*blend
   local yaw=2*math.sin(p*math.pi*2)*drive*blend
   -- The large body loads back, drives forward, then settles with a small recoil.
   pose(j.Bone,mix(1.2*math.sin(phase*2),bodyPitch,blend),
    (-.07*wind+.16*drive)*blend,
    mix(.035*(1-math.cos(phase*2)),-.035*wind+.015*impact,blend),
    1.2*step*(1-blend),yaw)
   local legs={
    {hip="Bone.014",knee="Bone.015",foot="Bone.016",offset=0},
    {hip="Bone.018",knee="Bone.019",foot="Bone.020",offset=math.pi*2/3},
    {hip="Bone.010",knee="Bone.011",foot="Bone.012",offset=math.pi*4/3},
   }
   for _,leg in legs do
    local stride=math.sin(phase+leg.offset)
    local lift=math.max(0,math.cos(phase+leg.offset))
    pose(j[leg.hip],mix(19*stride,-bodyPitch+3*wind,blend),
     -.065*drive*blend,0,0,-yaw)
    pose(j[leg.knee],mix(-4-23*lift,-7-4*wind,blend))
    pose(j[leg.foot],mix(-9*stride+6*lift,3+3*drive,blend))
   end
   -- Head and jaw carry the attack; the feet stay in a braced stance.
   pose(j["Bone.001"],mix(-1.2*math.sin(phase*2),6*wind-12*drive,blend))
   pose(j["Bone.003"],mix(-1*math.sin(phase*2),-4-13*wind-7*drive,blend))
   pose(j["Bone.004"],mix(0,-3*wind+2*impact,blend))
   pose(j["Bone.005"],mix(1*step,-2*wind+3*impact,blend))
   -- The tail trails the torso turn instead of moving at the same instant.
   local tail=math.sin(p*math.pi*2-.65)*drive
   pose(j["Bone.007"],mix(1.5*step,2*tail,blend),0,0,0,mix(5*step,7*tail,blend))
   pose(j["Bone.009"],mix(-2*step,-3*tail,blend),0,0,0,mix(-7*step,-10*tail,blend))
   pose(j["Bone.006"],mix(1*step,1.5*tail,blend))
  end
 end
end)
