local CollectionService = game:GetService("CollectionService")
local RunService = game:GetService("RunService")
local TAG = "FastWalkingPatapim"
local rigs = {}
local initializing = {}
local boneNames = {"Bone","Bone.001","Bone.002","Bone.003","Bone.004","Bone.005","Bone.006","Bone.007","Bone.010","Bone.011","Bone.012","Bone.013","Bone.014","Bone.015"}
local function setup(model)
 if rigs[model] or initializing[model] then return end
 initializing[model] = true
 task.spawn(function()
 local mesh = model:WaitForChild("Mesh",10)
 local root = mesh and mesh:WaitForChild("Bone",10)
 if not root or not root:IsA("Bone") then initializing[model]=nil; return end
 local deadline = os.clock()+10
 local complete
 repeat
  complete = true
  for _,name in boneNames do
   if name ~= "Bone" and not root:FindFirstChild(name,true) then complete=false;break end
  end
  if not complete then task.wait(.1) end
 until complete or os.clock()>=deadline or not model:IsDescendantOf(workspace)
 if not complete or not CollectionService:HasTag(model,TAG) then initializing[model]=nil;return end
 local side, forward, up = mesh.CFrame.RightVector, mesh.CFrame.LookVector, mesh.CFrame.UpVector
 local joints = {}
 local function joint(name)
  local bone = name == "Bone" and root or root:FindFirstChild(name, true)
  if not bone or not bone:IsA("Bone") then return nil end
  local data = {bone=bone, rest=bone.Transform,
   side=bone.WorldCFrame:VectorToObjectSpace(side).Unit,
   forward=bone.WorldCFrame:VectorToObjectSpace(forward).Unit,
   up=bone.WorldCFrame:VectorToObjectSpace(up)}
  joints[name] = data
  return data
 end
 for _,name in boneNames do joint(name) end
 rigs[model] = {mesh=mesh, joints=joints, active=false, attackBlend=0}
 initializing[model]=nil
 end)
end
local function reset(rig)
 for _,j in rig.joints do if j.bone.Parent then j.bone.Transform=j.rest end end
 rig.active=false
 rig.attackBlend=0
end
local function swing(rig, name, degrees)
 local j = rig.joints[name]
 if j then j.bone.Transform=j.rest*CFrame.fromAxisAngle(j.side,math.rad(degrees)) end
end
for _,model in CollectionService:GetTagged(TAG) do setup(model) end
CollectionService:GetInstanceAddedSignal(TAG):Connect(setup)
CollectionService:GetInstanceRemovedSignal(TAG):Connect(function(model)
 local rig=rigs[model]
 if rig then reset(rig);rigs[model]=nil end
end)
local function mix(a,b,t) return a+(b-a)*t end
local function jab(progress)
 if progress<0 or progress>=1 then return 0 end
 local t=progress<.25 and progress/.25 or (1-progress)/.75
 return t*t*(3-2*t)
end
-- Apply after the Animator evaluates, using synchronized time and the rig's bind axes.
RunService.PreSimulation:Connect(function(dt)
 local camera=workspace.CurrentCamera
 local now=workspace:GetServerTimeNow()
 for model,rig in rigs do
  if not model:IsDescendantOf(workspace) or not rig.mesh.Parent then
   reset(rig);rigs[model]=nil
  elseif model:GetAttribute("WalkEnabled")==false or not camera
   or (camera.CFrame.Position-rig.mesh.Position).Magnitude>200 then
   if rig.active then reset(rig) end
  else
   rig.active=true
   local cycle=math.clamp(model:GetAttribute("WalkCycleSeconds") or .45,.25,2)
   local strength=math.clamp(model:GetAttribute("WalkAmplitude") or 1,0,1.5)
   local phase=(now%cycle)/cycle*math.pi*2
   local step=math.sin(phase)
   local leftLift=math.max(0,math.cos(phase))
   local rightLift=math.max(0,-math.cos(phase))
   local attacking=model:GetAttribute("PatapimState")=="Punch"
   rig.attackBlend=mix(rig.attackBlend,attacking and 1 or 0,1-math.exp(-dt/.08))
   local blend=rig.attackBlend
   local punchCycle=math.clamp(model:GetAttribute("PunchCycleSeconds") or .38,.24,1)
   local punchPhase=((now-(model:GetAttribute("PunchStartedAt") or 0))%punchCycle)/punchCycle
   local leftJab=jab(punchPhase*2)
   local rightJab=jab((punchPhase-.5)*2)
   local recoil=leftJab+rightJab
   local root=rig.joints.Bone
   local bounce=mix(.055*(1-math.cos(phase*2)),.018*(1-math.cos(punchPhase*math.pi*4)),blend)
   root.bone.Transform=root.rest
    *CFrame.new(root.up*bounce*strength)
    *CFrame.fromAxisAngle(root.side,math.rad(mix(4+1.5*math.sin(phase*2),6-2*recoil,blend))*strength)
    *CFrame.fromAxisAngle(root.up.Unit,math.rad(7*(leftJab-rightJab)*blend)*strength)
    *CFrame.fromAxisAngle(root.forward,math.rad(2.2*step*(1-blend))*strength)
   swing(rig,"Bone.010",mix(32*step,10,blend)*strength)
   swing(rig,"Bone.013",mix(-32*step,-10,blend)*strength)
   swing(rig,"Bone.011",mix(-(5+35*leftLift),-9-2*recoil,blend)*strength)
   swing(rig,"Bone.014",mix(-(5+35*rightLift),-9-2*recoil,blend)*strength)
   swing(rig,"Bone.012",mix(-14*step+12*leftLift,-3,blend)*strength)
   swing(rig,"Bone.015",mix(14*step+12*rightLift,3,blend)*strength)
   swing(rig,"Bone.002",mix(-23*step,42+48*leftJab,blend)*strength)
   swing(rig,"Bone.005",mix(23*step,42+48*rightJab,blend)*strength)
   swing(rig,"Bone.003",mix(8+9*rightLift,70-65*leftJab,blend)*strength)
   swing(rig,"Bone.006",mix(8+9*leftLift,70-65*rightJab,blend)*strength)
   swing(rig,"Bone.004",mix(-4*step,-10+8*leftJab,blend)*strength)
   swing(rig,"Bone.007",mix(4*step,-10+8*rightJab,blend)*strength)
   swing(rig,"Bone.001",mix(-2-1.2*math.sin(phase*2),-3+1.5*recoil,blend)*strength)
  end
 end
end)
