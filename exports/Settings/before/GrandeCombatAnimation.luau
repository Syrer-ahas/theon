local CollectionService=game:GetService("CollectionService")
local RunService=game:GetService("RunService")
local TAG="GrandeCombat"
local rigs={}
local pending={}
local names={"Bone","Bone.001","Bone.002","Bone.003","Bone.004","Bone.005","Bone.006","Bone.007","Bone.008"}
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
   local cycle=math.clamp(model:GetAttribute("PunchCycleSeconds") or 1.25,.8,2)
   local p=((now-(model:GetAttribute("PunchStartedAt") or 0))%cycle)/cycle
   local lw,le,lh=strike(p/.43)
   local rw,re,rh=strike((p-.47)/.48)
   local wind=lw+rw
   local impact=lh+rh
   local drive=le+re
   local yaw=(-12*le+17*re+7*lw-9*rw)*blend
   local shift=(-.07*le+.09*re)*blend
   local lean=(-2-4*drive+3*wind)*blend
   local j=rig.joints
   -- Load the weight before the strike, then settle after impact.
   pose(j.Bone,mix(3,lean,blend),.08*drive*blend,
    mix(.045*(1-math.cos(phase*2)),-.065*wind+.02*impact,blend),
    mix(1.7*step,-2*le+3*re,blend),yaw,shift)
   pose(j["Bone.006"],mix(26*step,-lean+3*re,blend),
    -.04*drive*blend,.07*math.max(0,math.cos(phase))*(1-blend),0,-yaw)
   pose(j["Bone.007"],mix(-23*step,-lean-3*le,blend),
    -.04*drive*blend,.06*math.max(0,-math.cos(phase))*(1-blend),0,-yaw)
   -- The two halves follow the strike differently rather than moving in unison.
   pose(j["Bone.001"],mix(-2*step,-4*le+2*lw,blend),0,0,-2*le*blend,-3*le*blend)
   pose(j["Bone.003"],mix(2*step,-5*re+2*rw,blend),0,0,2*re*blend,3*re*blend)
   -- Left sweeping hook, then a heavier right overhand.
   pose(j["Bone.008"],mix(-19*step,24+49*le-15*lw+5*re,blend),
    0,0,mix(0,-8-10*le,blend),mix(0,29*le-18*lw,blend))
   pose(j["Bone.005"],mix(19*step,27+62*re-19*rw+5*le,blend),
    0,0,mix(0,8+12*re-7*rw,blend),mix(0,-16*re+12*rw,blend))
   -- Heads lag behind the shoulders, then recover into the guard.
   pose(j["Bone.002"],mix(1.5*step,-3-4*lw+3*le,blend),0,0,0,-yaw*.45)
   pose(j["Bone.004"],mix(-1.5*step,-3-4*rw+3*re,blend),0,0,0,-yaw*.55)
  end
 end
end)
