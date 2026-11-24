// Which glossary term (terms.js) explains each input and result of each
// calculator. `in` covers inputs and `out` covers results, written as
// "fieldId:termKey" pairs. A result id ending in a number (Reaction 1, 2, …)
// is looked up as "id#", so "R#" covers R1, R2 and so on.
//
// tests/glossary.mjs checks that every visible input and every result of
// every calculator has a term here, so a new field can't slip through.

const pairs = (s) => Object.fromEntries(s.trim().split(/\s+/).map((p) => p.split(":")));
const def = (inputs, results) => ({ in: pairs(inputs), out: pairs(results) });

export const FIELD_TERMS = {
  // Fluids
  "pump-system": def(
    `Q:flowRate rho:density mu:dynViscosity pv:vaporPressure site:elevation src:liquidLevel mainP:gaugePressure srcP:gaugePressure
     zs:liquidLevel dst:liquidLevel zd:liquidLevel dstP:gaugePressure NPSHr:npshr H0:shutoffHead Qr:pumpCurvePoint Hr:pumpCurvePoint
     Qm:pumpCurvePoint Hm:pumpCurvePoint eta:pumpEff etaM:motorEff`,
    `NPSHa:npsha margin:npshMargin ratio:npshMargin npshCheck:npshMargin TDH:tdh static:staticHead hfS:headLoss hfD:headLoss
     pS:gaugePressure pD:gaugePressure patm:atmPressure Ph:hydraulicPower Ps:shaftPower Pe:electricalInput`
  ),
  "pipe-velocity": def(`Q:flowRate D:insideDiameter`, `v:velocity A:flowArea hv:velocityHead`),
  reynolds: def(`v:velocity D:charLength rho:density mu:dynViscosity`, `Re:reynolds regime:flowRegime nu:kinViscosity`),
  "pressure-drop": def(
    `Q:flowRate D:insideDiameter L:pipeLength K:kFactor eps:roughness rho:density mu:dynViscosity`,
    `dp:pressureDrop hf:headLoss dpL:pressureDropPer100 v:velocity Re:reynolds regime:flowRegime f:frictionFactor P:frictionPower`
  ),
  "hazen-williams": def(`Q:flowRate D:insideDiameter L:pipeLength C:hazenC`, `hf:headLoss dp:pressureDrop dpL:pressureDropPer100 v:velocity`),
  hydrostatic: def(`h:depth rho:density p0:surfacePressure`, `pg:gaugePressure pa:absPressure grad:pressureGradient`),
  "pump-power": def(`Q:flowRate H:tdh rho:density eta:pumpEff etaM:motorEff`, `Ps:shaftPower Ph:hydraulicPower Pe:electricalInput dp:pressureRise`),
  orifice: def(`d:orificeDiameter D:insideDiameter dp:diffPressure Cd:dischargeCoeff rho:density`, `Q:flowRate m:massFlow beta:betaRatio v:velocity`),
  manning: def(
    `shape:channelShape b:bottomWidth z:sideSlope Dc:insideDiameter y:waterDepth S:bedSlope n:manningN`,
    `Q:flowRate v:velocity A:flowArea R:hydraulicRadius Fr:froude regime:froude`
  ),
  buoyancy: def(`V:submergedVolume m:mass rho:density`, `Fb:buoyantForce W:weight net:netForce float:netForce rhoObj:avgDensity`),
  "tank-drain": def(`Dt:tankDiameter h:liquidHeight d:outletDiameter Cd:dischargeCoeff`, `t:drainTime Q0:flowRate v0:jetVelocity V:volume`),

  // Heat
  "heat-energy": def(`m:mass cp:specificHeat dT:tempChange P:heaterPower eta:efficiency`, `Q:heatEnergy t:heatingTime kwh:heatEnergy`),
  conduction: def(`k:thermalConductivity t:thickness A:area dT:tempDifference`, `q:heatFlow R:rValue U:uValue flux:heatFlux Rin:rPerInch`),
  convection: def(`h:convCoeff A:area Ts:surfaceTemp Tf:fluidTemp`, `q:heatFlow flux:heatFlux`),
  radiation: def(`eps:emissivity A:area Ts:surfaceTemp Tsur:surroundTemp`, `q:heatFlow flux:heatFlux hr:radCoeff`),
  "thermal-expansion": def(`alpha:expansionCoeff E:youngsModulus L:length dT:tempChange`, `dL:changeInLength strain:strain sigma:thermalStress dV:volumeChange`),
  lmtd: def(
    `arr:flowArrangement Thi:streamTemp Tho:streamTemp Tci:streamTemp Tco:streamTemp U:overallU Q:heatDuty`,
    `A:exchangerArea lmtd:lmtd d1:endDeltaT d2:endDeltaT`
  ),

  // Air and HVAC
  psychrometrics: def(
    `T:dryBulb rh:relHumidity pmode:pressureSource z:altitude p:barometric`,
    `dew:dewPoint wet:wetBulb W:humidityRatio h:enthalpy v:specificVolume rho:density pw:vaporPartialPressure P:barometric`
  ),
  "air-heat": def(`Q:airflow dT:tempChange rho:density cp:specificHeat`, `q:sensibleHeat tons:coolingTons m:massFlow`),
  "duct-size": def(`Q:airflow shape:ductShape a:ductSize b:ductSize D:ductSize`, `v:velocity A:flowArea De:equivRound Dh:hydraulicDiameter ar:aspectRatio`),
  "standard-atmosphere": def(
    `z:altitude dT:isaOffset`,
    `p:atmPressure T:temperature rho:density sigma:densityRatio delta:pressureRatio a:speedOfSound mu:dynViscosity`
  ),
  "ideal-gas": def(`M:molarMass p:absPressure T:temperature`, `rho:density v:specificVolume R:gasConstant Vm:molarVolume`),
  "fan-system": def(
    `Q:airflow z:elevation T:temperature rh:relHumidity margin:safetyMargin fanEff:efficiency driveEff:driveEff motorEff:motorEff
     rate:frictionRate vmax:velocityLimit fan:fanCurvePoint P0:fanCurvePoint Qr:fanCurvePoint Pr:fanCurvePoint Qmax:fanCurvePoint`,
    `P:fanPressure Pstd:standardAirPressure bhp:shaftPower motor:motorSize input:electricalInput sys:systemLoss pduct:systemLoss
     pfit:systemLoss pcomp:systemLoss rho:density ratio:densityRatio scfm:standardAirflow vmaxd:velocity L:ductLength
     opQ:operatingPoint opP:operatingPoint opPct:operatingPoint`
  ),
  "building-loads": def(
    `lat:latitude month:designMonth z:elevation Tdb:designTemp Twb:wetBulb DR:dailyRange Twin:designTemp Ti:setpoint rhi:relHumidity
     Tih:setpoint Ts:supplyAirTemp taub:opticalDepth taud:opticalDepth occ0:occupiedHours occ1:occupiedHours offL:afterHours
     offE:afterHours margin:safetyMargin`,
    `coil:coolingLoad heat:heatingLoad dTh:designDeltaT dTc:designDeltaT coilS:sensibleLoad room:roomLoad hour:peakHour sum:sumOfPeaks
     oa:outdoorAirLoad Qsup:supplyAirflow Qoa:outdoorAir heatRoom:heatingLoad heatOa:outdoorAirLoad area:floorArea perArea:loadPerArea`
  ),

  // Mechanics and structures
  beam: def(
    `setup:beamSetup support:supports load:loadType L:span P:pointLoad a:loadPosition w:udl E:youngsModulus I:inertia S:sectionModulus`,
    `y:deflection ratio:spanRatio M:bendingMoment V:shearForce RA:reaction RB:reaction sigma:bendingStress xY:deflectionLocation
     Mpos:sagging Mneg:sagging R#:reaction MR#:fixedEndMoment total:totalLoad MA:fixedEndMoment`
  ),
  "section-properties": def(
    `shape:sectionShape b:sectionDim h:sectionDim D:sectionDim B:sectionDim H:sectionDim s:sectionDim t:sectionDim tf:sectionDim
     tw:sectionDim M:bendingMomentInput V:shearInput P:axialForce rho:density Sy:yieldStrength`,
    `Ix:inertia Sx:sectionModulus A:sectionArea Iy:inertia Sy:sectionModulus rx:radiusGyration ry:radiusGyration J:torsionConstant
     wt:weightPerLength sTop:edgeStress sBot:edgeStress tau:shearStress vm:vonMises fos:safetyFactor yc:centroid xc:centroid
     Imin:leastInertia rmin:radiusGyration`
  ),
  "stress-strain": def(`F:axialForce A:sectionArea L:length E:youngsModulus Sy:yieldStrength`, `s:stress dL:changeInLength e:strain fos:safetyFactor k:axialStiffness`),
  buckling: def(
    `ends:endConditions L:columnLength E:youngsModulus I:leastInertia A:sectionArea`,
    `P:criticalLoad s:criticalStress lam:slenderness Le:effectiveLength`
  ),
  "torque-power": def(`P:power n:speed tau:allowableShear`, `T:torque d:shaftDiameter w:angularSpeed`),
  "gear-ratio": def(`N1:teeth N2:teeth n1:speed T1:torque eta:efficiency`, `i:gearRatio n2:speed T2:torque P:power`),
  "bolt-torque": def(`size:boltSize grade:boltGrade pct:preloadPct K:nutFactor`, `T:tighteningTorque F:preload Fp:proofLoad As:tensileStressArea`),
  spring: def(
    `d:wireDiameter Dm:meanCoilDiameter Na:activeCoils Gm:shearModulus F:load`,
    `k:springRate x:springDeflection tau:springShear C:springIndex`
  ),
  "energy-motion": def(`m:mass v:objectSpeed h:height`, `KE:kineticEnergy PE:potentialEnergy p:momentum vf:impactSpeed heq:equivalentDrop`),

  // Electrical
  "ohms-law": def(`mode:knownPair V:voltage I:current R:resistance P:elecPower`, `R:resistance P:elecPower V:voltage I:current`),
  "voltage-drop": def(
    `sys:systemType metal:conductorMetal size:wireSize L:oneWayLength I:current V:voltage T:conductorTemp limit:allowedDrop`,
    `Vd:voltageDrop pct:dropPct Vl:loadVoltage loss:cableLoss best:suggestedSize`
  ),
  "resistor-code": def(`bands:bandCount b1:colorBand b2:colorBand b3:colorBand m:colorBand t:tolerance`, `R:resistance tol:tolerance range:valueRange`),
  "series-parallel": def(`part:partType list:valuesList`, `s:seriesValue p:parallelValue n:count`),
  "rc-time": def(`R:resistance C:capacitance`, `tau:timeConstant t95:settleTime t99:settleTime fc:cutoffFreq`),
  "three-phase": def(
    `mode:knownPair V:lineVoltage I:lineCurrent P:realPower pf:powerFactor`,
    `P:realPower S:apparentPower Q:reactivePower I:lineCurrent`
  ),
  "battery-runtime": def(
    `Ah:batteryCapacity V:batteryVoltage P:loadPower dod:dod eta:efficiency`,
    `t:runtime E:storedEnergy Eu:usableEnergy I:batteryCurrent`
  ),

  // Geometry and math
  "tank-volume": def(`shape:tankShape D:dimension L:dimension W:dimension H:dimension h:liquidHeight`, `fill:liquidVolume total:capacity pct:fillPct space:roomLeft`),
  shapes: def(`shape:shape a:dimension b:dimension c:dimension`, `A:area C:perimeter d:spaceDiagonal V:volume S:surfaceArea Sl:sideArea s:slantHeight`),
  slope: def(`rise:rise run:run`, `pct:grade ang:angle ratio:slopeRatio pitch:roofPitch len:slopedLength`),
  interpolate: def(`x1:knownPoint y1:knownPoint x2:knownPoint y2:knownPoint x:lookupX`, `y:interpolated`),
};
