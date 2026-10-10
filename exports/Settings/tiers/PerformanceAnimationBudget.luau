-- Client-only animation budget. Driving physics and server combat are unaffected.
local Players=game:GetService('Players')
local player=Players.LocalPlayer
local Budget={}
local level=player:GetAttribute('Setting_PerformanceMode') or (player:GetAttribute('Setting_Performance')==true and 2 or 0)
local enabled=level>0
player:GetAttributeChangedSignal('Setting_Performance'):Connect(function()
 level=player:GetAttribute('Setting_PerformanceMode') or (player:GetAttribute('Setting_Performance')==true and 2 or 0)
 enabled=level>0
end)
player:GetAttributeChangedSignal('Setting_PerformanceMode'):Connect(function()
 level=player:GetAttribute('Setting_PerformanceMode') or 0;enabled=level>0
end)
function Budget.Step(state,position,dt,camera,ownVehicle)
 if not enabled or ownVehicle then
  state.performanceElapsed=0
  return true,dt
 end
 if not camera then return false,dt end
 local offset=position-camera.CFrame.Position
 local distance2=offset:Dot(offset)
 state.performanceElapsed=(state.performanceElapsed or 0)+dt
 -- Near action stays fluid; distant offscreen rigs do no bone writes.
 local outside=offset:Dot(camera.CFrame.LookVector)<0
 if not outside and distance2>35*35 and typeof(camera)=='Instance' then
  local point=camera:WorldToViewportPoint(position)
  local viewport=camera.ViewportSize
  outside=point.Z<=0 or point.X< -180 or point.Y< -180 or point.X>viewport.X+180 or point.Y>viewport.Y+180
 end
 if distance2>35*35 and outside then
  state.performanceElapsed=0
  return false,dt
 end
 local interval
 if level==1 then interval=distance2<=65*65 and 0 or distance2<=110*110 and 1/30 or 1/15
 else interval=distance2<=35*35 and 1/60 or distance2<=75*75 and 1/30 or distance2<=110*110 and 1/15 or 1/10 end
 if state.performanceElapsed+0.000001<interval then return false,dt end
 local elapsed=math.min(state.performanceElapsed,.15)
 state.performanceElapsed=0
 return true,elapsed
end
return Budget
