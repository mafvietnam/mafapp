# MAF RULES SUMMARY

## Based on "The Big Book of Endurance Training and Racing" by Dr. Phil Maffetone

This document outlines the core business rules for the MAF (Maximum Aerobic Function) training method implemented in this application.

---

## 1. THE 180 FORMULA (Heart Rate Calculation)

The MAF heart rate is calculated using the 180 Formula:

### Base Formula
```
MAF Heart Rate = 180 - Age
```

### Adjustments

#### Subtract 10 beats if:
- Currently recovering from major illness or surgery
- Recently hospitalized
- Currently on medication (regular basis)
- Experiencing chronic illness

#### Subtract 5 beats if:
- Taking medication for chronic conditions
- Recovering from injury (within last 6 months)
- Training has been inconsistent or high heart rate
- Getting more than 2 colds per year
- Having allergies or asthma

#### Add 0 beats if:
- New to exercise (no adjustment needed)
- Training consistently for less than 2 years
- Recently returned from injury/illness

#### Add 5 beats if:
- Training consistently for more than 2 years
- Making competitive progress without injury
- Consistently healthy

### Example Calculations

**Example 1: 35-year-old beginner**
```
180 - 35 = 145 bpm (no adjustments)
```

**Example 2: 40-year-old experienced runner, recovering from injury**
```
180 - 40 = 140
140 - 5 (injury) = 135 bpm
```

**Example 3: 50-year-old advanced athlete**
```
180 - 50 = 130
130 + 5 (advanced) = 135 bpm
```

---

## 2. SPECIAL POPULATION RULES

### Children (Under 16 Years Old)

**RULE: No structured aerobic training**

- Children under 16 should NOT follow structured training plans
- Focus should be on **PLAY** and natural movement
- Activities: Running games, sports, swimming, cycling for fun
- No heart rate monitoring needed
- No duration targets
- Emphasis on enjoyment and natural development

**Reasoning (Chapter 29):**
- Children's aerobic systems develop naturally through play
- Structured training can interfere with natural development
- Risk of burnout and injury from early specialization
- Play-based activity promotes lifelong fitness habits

**Application Recommendation:**
> "Thay vì tập luyện theo giáo án, trẻ em nên tập trung vào VUI CHƠI tự nhiên: Chạy nhảy, bơi lội, đạp xe, và các trò chơi thể thao. Không cần theo dõi nhịp tim hay thời lượng cố định."

---

### Seniors (60 Years and Older)

**RULE: Medical clearance required for training beyond health maintenance**

#### Safety Requirements:

1. **Medical Clearance (Chapter 6)**
   - Annual medical check-up recommended
   - Cardiovascular screening before intensive training
   - Blood pressure and cholesterol monitoring
   - Discussion with physician about training goals

2. **Training Modifications:**
   - Maximum session duration: **90 minutes** (enforced by system)
   - Start with HEALTH commitment level (3-4 hours/week)
   - Progress to BASE level (5-6 hours/week) only with medical clearance
   - PERFORMANCE level (7-10 hours/week) NOT recommended

3. **Recovery Priority:**
   - Extra rest days between sessions
   - Longer warm-up (at least 15 minutes)
   - Longer cool-down (at least 15 minutes)
   - Listen to body signals more carefully

4. **Warning Signs to Watch:**
   - Unusual fatigue lasting >24 hours
   - Joint pain or stiffness
   - Difficulty sleeping
   - Elevated resting heart rate
   - Loss of motivation

**Application Note:**
> "Người trên 60 tuổi PHẢI có xác nhận y tế trước khi tăng cường độ tập luyện. Hệ thống sẽ giới hạn thời lượng tối đa 90 phút/buổi và ưu tiên các bài tập an toàn."

---

## 3. THE 15/15 RULE (Chapter 5)

**Every training session must include:**

### Warm-up: 15 minutes
- Start VERY easy (walking or very slow jogging)
- Heart rate should be well below MAF (MAF - 20 or lower)
- Gradually increase intensity
- Never skip this phase

### Main Set: Variable duration
- Maintain heart rate in MAF zone (MAF - 10 to MAF)
- Use heart rate monitor continuously
- Slow down or walk if heart rate exceeds MAF

### Cool-down: 15 minutes
- Gradually decrease intensity
- Return to very easy pace
- End with walking
- Allows proper recovery initiation

**Exception:** Sessions under 30 minutes total should be entirely easy (below MAF - 20)

---

## 4. BMI-BASED SAFETY RULES (Chapter 29)

### Obese (BMI ≥ 30)
- **Rule:** No running - WALK ONLY or LOW IMPACT activities
- Recommended: Walking, cycling, swimming, elliptical
- Protects joints from high-impact stress
- Default pace: 18:00 min/km (walking)

### Overweight (BMI 25-29.9)
- **Rule:** Careful progression, brisk walking or easy jogging
- Monitor for joint discomfort
- Default pace: 14:00 min/km (brisk walk/jog)
- Can progress to running as weight normalizes

### Normal Weight (BMI 18.5-24.9)
- Standard MAF training applies
- Default pace: 10:00 min/km (if no test data)

---

## 5. EXPERIENCE LEVEL MODIFICATIONS

### Never Exercised (Score: 0)
- No adjustment to 180 Formula
- Start with HEALTH commitment only
- Maximum 60 minutes per session (beginner safety cap)
- Focus on consistency, not speed

### Inconsistent Training / High Heart Rate (Score: -5)
- Subtract 5 beats from MAF
- Rebuild aerobic base from ground up
- Reset expectations
- Focus on discipline to stay below MAF

### Regular Training < 2 Years (Score: 0)
- No adjustment
- Continue building aerobic foundation
- Avoid temptation to add intensity

### Advanced > 2 Years (Score: +5)
- Add 5 beats to MAF
- Reward for consistent, injury-free progress
- Can handle higher aerobic volume

---

## 6. COMMITMENT LEVELS (Chapter 9)

### HEALTH (3-4 hours/week)
- Goal: Health maintenance, fat burning
- 3-4 sessions per week
- Typical: 3 x 45-60 minute sessions
- Focus: Consistency over intensity

### BASE (5-6 hours/week)
- Goal: Maximum aerobic function development
- 4-5 sessions per week
- Includes 1 long run (90 minutes)
- Focus: Building aerobic engine

### PERFORMANCE (7-10 hours/week)
- Goal: Competitive performance
- 5-6 sessions per week
- Includes long runs (120+ minutes)
- Requires: Proven aerobic base, no injuries
- Warning: High risk if foundation incomplete

---

## 7. TRAINING = WORK + REST (Chapter 7)

**Critical Balance:**
- Training stress must be matched with adequate recovery
- Rest days are when adaptations occur
- Overtraining = Work without Rest
- Signs of inadequate rest:
  - Elevated morning heart rate
  - Persistent fatigue
  - Declining performance
  - Loss of motivation
  - Increased injuries/illness

---

## 8. SYSTEM IMPLEMENTATION LOGIC

### Age < 16
```
IF age < 16 THEN
  DISPLAY: "Play-based recommendation"
  NO schedule generation
  NO heart rate calculation
END IF
```

### Age ≥ 60
```
IF age >= 60 THEN
  IF NOT medicalClearanceConfirmed THEN
    FORCE: HEALTH commitment level only
  ELSE
    ALLOW: HEALTH or BASE (max)
    RESTRICT: No PERFORMANCE level
  END IF
  
  FOR ALL sessions:
    CAP duration at 90 minutes
  END FOR
END IF
```

### 180 Formula Implementation
```
maf = 180 - age

IF isRecovering THEN
  maf = maf - 10
END IF

IF isMedicatedOrInjured THEN
  maf = maf - 5
END IF

maf = maf + experienceScore
// Where experienceScore is:
// -5 for Inconsistent
//  0 for None/Regular_New
// +5 for Advanced
```

### BMI Safety
```
IF bmi >= 30 THEN
  REPLACE all "Run" with "Walk"
  SET defaultPace = "18:00"
END IF

IF bmi >= 25 AND bmi < 30 AND noPaceTest THEN
  SUGGEST "Brisk Walk/Jog"
  SET defaultPace = "14:00"
END IF
```

---

## REFERENCES

- **Chapter 1:** Health vs Fitness - Foundation concepts
- **Chapter 3:** Aerobic System Development
- **Chapter 5:** Warming Up and Cooling Down (15/15 Rule)
- **Chapter 6:** The 180 Formula details
- **Chapter 7:** Training = Work + Rest
- **Chapter 9:** Personalize Your Training (Commitment levels)
- **Chapter 10:** Performance Development
- **Chapter 29:** Special Populations (Children, Seniors, Safety)

---

**Last Updated:** November 27, 2025  
**Application Version:** 1.0  
**Based on:** "The Big Book of Endurance Training and Racing" - Dr. Phil Maffetone
