local CollectionService=game:GetService("CollectionService")
local RunService=game:GetService("RunService")
local TAG="PipiCombat"
local rigs={}
local pending={}
local names={"Bone","Bone.001","Bone.002","Bone.003","Bone.004","Bone.005","Bone.006","Bone.007","Bone.008","Bone.009","Bone.010","Bone.011"}
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
   local cycle=math.clamp(model:GetAttribute("PunchCycleSeconds") or 1.05,.7,2)
   local p=((now-(model:GetAttribute("PunchStartedAt") or 0))%cycle)/cycle
   local lw,le,lh=strike(p/.43)
   local rw,re,rh=strike((p-.46)/.48)
   local wind=lw+rw
   local extension=le+re
   local impact=lh+rh
   local yaw=(-14*le+20*re+6*lw-8*rw)*blend
   local lean=(-2-3*extension+2*wind)*blend
   local shift=(-.065*le+.085*re)*blend
   local j=rig.joints
   pose(j.Bone,mix(3,lean,blend),.09*extension*blend,
    mix(.055*(1-math.cos(phase*2)),-.045*wind+.015*impact,blend),
    mix(1.5*step,-2*le+2.5*re,blend),yaw,shift)
   -- Feet counter the torso turn so the punches have a planted base.
   pose(j["Bone.011"],mix(25*step,-lean+4*re,blend),
    -.045*extension*blend,mix(.065*leftLift,.025*le,blend),0,-yaw)
   pose(j["Bone.010"],mix(-25*step,-lean-3*le,blend),
    -.045*extension*blend,mix(.065*rightLift,.025*re,blend),0,-yaw)
   -- The jab is short and crisp; the cross carries more shoulder rotation.
   pose(j["Bone.001"],mix(-22*step,32+52*le-11*lw+4*re,blend),
    0,0,mix(0,-7-5*le,blend),mix(0,-5*le,blend))
   pose(j["Bone.004"],mix(22*step,34+57*re-14*rw+4*le,blend),
    0,0,mix(0,7+7*re,blend),mix(0,7*re,blend))
   pose(j["Bone.002"],mix(8+8*rightLift,94-84*le+8*lw+5*re,blend))
   pose(j["Bone.005"],mix(8+8*leftLift,96-87*re+10*rw+5*le,blend))
   pose(j["Bone.003"],mix(-3*step,-7+9*le,blend),0,0,-12*le*blend)
   pose(j["Bone.006"],mix(3*step,-7+10*re,blend),0,0,15*re*blend)
   -- Head counter-rotation and delayed ear motion add follow-through.
   pose(j["Bone.007"],mix(-1.5*math.sin(phase*2),-4-3*wind+2*extension,blend),
    0,0,0,-yaw*.65)
   local follow=math.sin(p*math.pi*4-.6)*extension
   pose(j["Bone.008"],mix(2*step,3*follow,blend))
   pose(j["Bone.009"],mix(-2*step,-3*follow,blend))
  end
 end
end)
