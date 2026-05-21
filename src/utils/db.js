import { db } from '../firebase';
import { collection, addDoc, getDocs, getDoc, query, where, updateDoc, doc, serverTimestamp, increment, orderBy, limit } from 'firebase/firestore';

import { onSnapshot } from 'firebase/firestore';

// Courses
export const createCourse = async (lecturerId, courseCode, courseName) => {
  const courseRef = await addDoc(collection(db, 'courses'), {
    lecturerId,
    courseCode,
    courseName,
    totalSessions: 0,
    createdAt: serverTimestamp()
  });
  return courseRef.id;
};

export const getLecturerCourses = async (lecturerId) => {
  const q = query(collection(db, 'courses'), where('lecturerId', '==', lecturerId));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
};

// Sessions
export const createSession = async (lecturerId, lecturerName, courseId, courseCode, courseName, venue, lat, lng, pwd, isStrict, startTime, endTime) => {
  const qrSecret = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  // 1. Create the session
  const sessionRef = await addDoc(collection(db, 'sessions'), {
    lecturerId,
    lecturerName: lecturerName || '',
    courseId: courseId || null,
    courseCode: courseCode || '',
    courseName,
    venue,
    location: { lat, lng },
    pwd,
    isStrict,
    startTime: startTime || '',
    endTime: endTime || '',
    attendanceLocked: false,
    status: 'active',
    qrSecret,
    createdAt: serverTimestamp()
  });

  // 2. Increment totalSessions in the course document
  if (courseId) {
    const courseRef = doc(db, 'courses', courseId);
    await updateDoc(courseRef, {
      totalSessions: increment(1)
    });
  }

  return { id: sessionRef.id, qrSecret };
};

export const getLecturerActiveSession = async (lecturerId) => {
  const q = query(collection(db, 'sessions'), where('lecturerId', '==', lecturerId), where('status', '==', 'active'));
  const snapshot = await getDocs(q);
  if (snapshot.empty) return null;
  const docSnap = snapshot.docs[0];
  return { id: docSnap.id, ...docSnap.data() };
};

export const isSessionExpired = (session) => {
  if (!session || !session.endTime || session.status !== 'active') return false;
  
  let createdDate = new Date();
  if (session.createdAt) {
    if (typeof session.createdAt.toDate === 'function') {
      createdDate = session.createdAt.toDate();
    } else if (session.createdAt.seconds) {
      createdDate = new Date(session.createdAt.seconds * 1000);
    } else {
      createdDate = new Date(session.createdAt);
    }
  }
  
  const [hours, minutes] = session.endTime.split(':').map(Number);
  if (isNaN(hours) || isNaN(minutes)) return false;

  const endDateTime = new Date(createdDate);
  endDateTime.setHours(hours, minutes, 0, 0);
  
  // If endDateTime is before createdDate, it represents a midnight rollover to the next day
  if (endDateTime < createdDate) {
    endDateTime.setDate(endDateTime.getDate() + 1);
  }
  
  const now = new Date();
  return now >= endDateTime;
};

export const isSessionUpcoming = (session) => {
  if (!session || !session.startTime || session.status !== 'active') return false;
  
  let createdDate = new Date();
  if (session.createdAt) {
    if (typeof session.createdAt.toDate === 'function') {
      createdDate = session.createdAt.toDate();
    } else if (session.createdAt.seconds) {
      createdDate = new Date(session.createdAt.seconds * 1000);
    } else {
      createdDate = new Date(session.createdAt);
    }
  }
  
  const [hours, minutes] = session.startTime.split(':').map(Number);
  if (isNaN(hours) || isNaN(minutes)) return false;

  const startDateTime = new Date(createdDate);
  startDateTime.setHours(hours, minutes, 0, 0);
  
  const now = new Date();
  return now < startDateTime;
};

export const getLecturerSessions = async (lecturerId) => {
  const q = query(collection(db, 'sessions'), where('lecturerId', '==', lecturerId), where('status', '==', 'active'));
  const snapshot = await getDocs(q);
  const list = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
  const active = [];
  
  for (const s of list) {
    if (isSessionExpired(s)) {
      endSession(s.id).catch(e => console.error('Error auto-ending session:', e));
    } else {
      active.push(s);
    }
  }
  return active;
};

export const getLecturerWeeklySessionCount = async (lecturerId) => {
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
  const q = query(collection(db, 'sessions'), where('lecturerId', '==', lecturerId), where('createdAt', '>=', oneWeekAgo));
  const snapshot = await getDocs(q);
  return snapshot.size;
};

export const getSessionsForCourse = async (courseId) => {
  const q = query(collection(db, 'sessions'), where('courseId', '==', courseId));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

export const getUserProfile = async (uid) => {
  const snapshot = await getDoc(doc(db, 'users', uid));
  if (!snapshot.exists()) return null;
  return { id: snapshot.id, ...snapshot.data() };
};

export const subscribeToAttendees = (sessionId, callback) => {
  const q = query(collection(db, 'attendance'), where('sessionId', '==', sessionId));
  return onSnapshot(q, (snapshot) => {
    const attendees = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    callback(attendees);
  });
};

export const getActiveSessions = async () => {
  const q = query(collection(db, 'sessions'), where('status', '==', 'active'));
  const snapshot = await getDocs(q);
  const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  const active = [];
  
  for (const s of list) {
    if (isSessionExpired(s)) {
      endSession(s.id).catch(e => console.error('Error auto-ending session:', e));
    } else {
      active.push(s);
    }
  }
  return active;
};

export const endSession = async (sessionId) => {
  const sessionRef = doc(db, 'sessions', sessionId);
  await updateDoc(sessionRef, { status: 'ended', attendanceLocked: true });
};

export const updateSession = async (sessionId, updates) => {
  const sessionRef = doc(db, 'sessions', sessionId);
  await updateDoc(sessionRef, updates);
};

export const getSession = async (sessionId) => {
  const sessionRef = doc(db, 'sessions', sessionId);
  const snapshot = await getDoc(sessionRef);
  if (!snapshot.exists()) return null;
  const session = { id: snapshot.id, ...snapshot.data() };
  if (isSessionExpired(session)) {
    endSession(session.id).catch(e => console.error('Error auto-ending session:', e));
    session.status = 'ended';
    session.attendanceLocked = true;
  }
  return session;
};

// Attendance
export const markAttendance = async (sessionId, studentId, locationDetails, studentName, matricNumber, courseId, courseOfStudy) => {
  await addDoc(collection(db, 'attendance'), {
    sessionId,
    studentId,
    courseId: courseId || null,
    studentName: studentName || studentId,
    matricNumber: matricNumber || '',
    courseOfStudy: courseOfStudy || '',
    locationDetails,
    status: 'Attended',
    timestamp: serverTimestamp()
  });
};

export const getAttendeesForSession = async (sessionId) => {
  const q = query(collection(db, 'attendance'), where('sessionId', '==', sessionId));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

export const manualCheckInByMatric = async (sessionId, courseId, matricNumber) => {
  // 1. Find the student by matric number
  const qUser = query(collection(db, 'users'), where('matricNumber', '==', matricNumber.trim()));
  const userSnap = await getDocs(qUser);
  
  if (userSnap.empty) {
    throw new Error(`Student not found with Matric Number: ${matricNumber}`);
  }
  
  const studentDoc = userSnap.docs[0];
  const studentData = studentDoc.data();
  const studentId = studentDoc.id;

  // Ensure they are a student
  if (studentData.role !== 'student') {
    throw new Error('User found is not registered as a student.');
  }

  // 2. Check if already checked in
  const qAtt = query(collection(db, 'attendance'), where('sessionId', '==', sessionId), where('studentId', '==', studentId));
  const attSnap = await getDocs(qAtt);
  
  if (!attSnap.empty) {
    throw new Error('Student is already marked present for this session.');
  }

  // 3. Mark attendance manually (auto-enrolls because we query enrollment off the attendance collection)
  await addDoc(collection(db, 'attendance'), {
    sessionId,
    studentId,
    courseId: courseId || null,
    studentName: studentData.name || studentId,
    matricNumber: studentData.matricNumber || matricNumber,
    courseOfStudy: studentData.course || '',
    locationDetails: null, // No GPS for manual check-in
    status: 'Attended',
    method: 'manual_check_in', // Tag to identify manual additions
    timestamp: serverTimestamp()
  });

  return { id: studentId, ...studentData };
};

// Returns a Set of sessionIds this student has already attended
export const getStudentAttendedSessionIds = async (studentId) => {
  const q = query(collection(db, 'attendance'), where('studentId', '==', studentId));
  const snapshot = await getDocs(q);
  const ids = new Set();
  snapshot.docs.forEach(d => ids.add(d.data().sessionId));
  return ids;
};

export const getStudentAttendanceForCourse = async (studentId, courseId) => {
  const q = query(collection(db, 'attendance'), where('studentId', '==', studentId), where('courseId', '==', courseId));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

export const getExpectedStudentsForSession = async (courseId, sessionDate) => {
  const q = query(collection(db, 'attendance'), where('courseId', '==', courseId));
  const snapshot = await getDocs(q);
  
  const studentEnrollments = {};
  snapshot.docs.forEach(d => {
    const data = d.data();
    const sid = data.studentId;
    const date = data.timestamp?.toDate?.() || new Date();
    
    if (!studentEnrollments[sid]) {
      studentEnrollments[sid] = {
        studentId: sid,
        studentName: data.studentName,
        matricNumber: data.matricNumber,
        enrollmentDate: date
      };
    } else if (date < studentEnrollments[sid].enrollmentDate) {
      studentEnrollments[sid].enrollmentDate = date;
    }
  });

  const sessionDay = new Date(sessionDate).setHours(0,0,0,0);
  
  return Object.values(studentEnrollments).filter(s => {
    const enrollDay = new Date(s.enrollmentDate).setHours(0,0,0,0);
    return enrollDay <= sessionDay;
  });
};

export const getStudentAttendanceStats = async (studentId) => {
  // 1. Get all attendance records for student
  const qAtt = query(collection(db, 'attendance'), where('studentId', '==', studentId));
  const snapAtt = await getDocs(qAtt);
  
  // Map of courseId -> { sessions: Set, firstDate }
  const courseData = {};
  const courseIds = new Set();

  snapAtt.docs.forEach(d => {
    const data = d.data();
    const cid = data.courseId;
    if (cid) {
      const recordDate = data.timestamp?.toDate?.() || new Date();
      if (!courseData[cid]) {
        courseData[cid] = { sessions: new Set(), firstDate: recordDate };
      }
      if (data.sessionId) {
        courseData[cid].sessions.add(data.sessionId);
      }
      if (recordDate < courseData[cid].firstDate) {
        courseData[cid].firstDate = recordDate;
      }
      courseIds.add(cid);
    }
  });

  if (courseIds.size === 0) return [];

  // 2. Fetch the corresponding course docs and sessions to calculate applicable totalSessions
  const stats = [];
  for (const cid of courseIds) {
    const cDoc = await getDoc(doc(db, 'courses', cid));
    if (cDoc.exists()) {
      const data = cDoc.data();
      const firstAttDate = courseData[cid].firstDate;

      // 3. Fetch all sessions for this course to calculate how many occurred AFTER enrollment
      const sessionsQ = query(collection(db, 'sessions'), where('courseId', '==', cid));
      const sessionsSnap = await getDocs(sessionsQ);
      
      let applicableTotalSessions = 0;
      sessionsSnap.docs.forEach(sessionDoc => {
        const sData = sessionDoc.data();
        const sessionDate = sData.createdAt?.toDate?.() || new Date();
        
        // We give a small buffer (e.g. same day) to handle time discrepancies. 
        // We'll compare start of day.
        const sessionDay = new Date(sessionDate).setHours(0,0,0,0);
        const firstAttDay = new Date(firstAttDate).setHours(0,0,0,0);

        if (sessionDay >= firstAttDay) {
          applicableTotalSessions += 1;
        }
      });

      stats.push({
        courseId: cid,
        courseCode: data.courseCode,
        courseName: data.courseName,
        totalSessions: applicableTotalSessions,
        attendedCount: courseData[cid].sessions.size
      });
    }
  }

  return stats;
};

/**
 * Fetch all attendance records for a given course, joined with session dates.
 * Returns an array of enriched attendance entries.
 */
export const getCourseAttendanceRecords = async (courseId) => {
  // 1. Get all sessions for the course so we can look up dates
  const sessQ = query(collection(db, 'sessions'), where('courseId', '==', courseId));
  const sessSnap = await getDocs(sessQ);
  const sessionMap = {};
  sessSnap.docs.forEach(d => {
    sessionMap[d.id] = d.data();
  });

  // 2. Get all attendance records for the course
  const attQ = query(collection(db, 'attendance'), where('courseId', '==', courseId));
  const attSnap = await getDocs(attQ);

  return attSnap.docs.map(d => {
    const data = d.data();
    const session = sessionMap[data.sessionId] || {};
    return {
      id: d.id,
      studentId: data.studentId,
      studentName: data.studentName || '',
      matricNumber: data.matricNumber || '',
      courseOfStudy: data.courseOfStudy || '',
      sessionId: data.sessionId,
      timestamp: data.timestamp,
      sessionDate: session.createdAt || data.timestamp,
      venue: session.venue || '',
    };
  });
};


/**
 * Fetch the last N attendance records for a student in a specific course.
 * Used for sparkline rendering in the session roster.
 */
export const getStudentRecentAttendance = async (studentId, courseId, limit = 5) => {
  const q = query(
    collection(db, 'attendance'),
    where('studentId', '==', studentId),
    where('courseId', '==', courseId)
  );
  const snap = await getDocs(q);
  const records = snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (a.timestamp?.toMillis?.() || 0) - (b.timestamp?.toMillis?.() || 0))
    .slice(-limit);
  return records;
};

/**
 * Fetch ALL sessions (active + ended) for a lecturer - used for heat-map calendar.
 */
export const getAllLecturerSessions = async (lecturerId) => {
  const q = query(collection(db, 'sessions'), where('lecturerId', '==', lecturerId));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
};

// Disputes
export const createDispute = async (studentId, sessionId, courseId, studentName, matricNumber, courseOfStudy, courseCode, courseName, sessionDate, venue, evidence, photo) => {
  const disputeRef = await addDoc(collection(db, 'disputes'), {
    studentId,
    sessionId,
    courseId,
    studentName,
    matricNumber,
    courseOfStudy,
    courseCode,
    courseName,
    sessionDate,
    venue,
    evidence: evidence || '',
    photo: photo || '',
    status: 'pending',
    timestamp: serverTimestamp()
  });

  // Get lecturerId from course document to create notification
  try {
    const courseDoc = await getDoc(doc(db, 'courses', courseId));
    if (courseDoc.exists()) {
      const lecturerId = courseDoc.data().lecturerId;
      if (lecturerId) {
        await addDoc(collection(db, 'notifications'), {
          userId: lecturerId,
          title: 'New Dispute Submitted',
          message: `${studentName} submitted a dispute for ${courseCode} (${sessionDate}).`,
          type: 'dispute_submitted',
          read: false,
          relatedId: disputeRef.id,
          createdAt: serverTimestamp()
        });
      }
    }
  } catch (err) {
    console.error('Failed to send dispute notification to lecturer', err);
  }

  return disputeRef.id;
};

export const getDisputesForCourse = async (courseId) => {
  const q = query(collection(db, 'disputes'), where('courseId', '==', courseId));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

export const getDisputesForStudent = async (studentId, courseId) => {
  const q = query(collection(db, 'disputes'), where('studentId', '==', studentId), where('courseId', '==', courseId));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

export const resolveDispute = async (disputeId, disputeData, status) => {
  const disputeRef = doc(db, 'disputes', disputeId);
  await updateDoc(disputeRef, { status });

  // Send notification to student
  const formattedStatus = status === 'approved' ? 'Approved' : 'Rejected';
  try {
    await addDoc(collection(db, 'notifications'), {
      userId: disputeData.studentId,
      title: `Dispute ${formattedStatus}`,
      message: `Your dispute for ${disputeData.courseCode} on ${disputeData.sessionDate} has been ${status}.`,
      type: 'dispute_resolved',
      read: false,
      relatedId: disputeId,
      createdAt: serverTimestamp()
    });
  } catch (err) {
    console.error('Failed to notify student of dispute resolution', err);
  }

  if (status === 'approved') {
    // Check if attendance already marked (to prevent duplicate marking)
    const qAtt = query(
      collection(db, 'attendance'),
      where('studentId', '==', disputeData.studentId),
      where('sessionId', '==', disputeData.sessionId)
    );
    const snapAtt = await getDocs(qAtt);
    
    if (snapAtt.empty) {
      let sessionTimestamp = serverTimestamp();
      try {
        const sessionDoc = await getDoc(doc(db, 'sessions', disputeData.sessionId));
        if (sessionDoc.exists()) {
          sessionTimestamp = sessionDoc.data().createdAt || serverTimestamp();
        }
      } catch (err) {
        console.error('Failed to fetch session timestamp for dispute', err);
      }

      await addDoc(collection(db, 'attendance'), {
        sessionId: disputeData.sessionId,
        studentId: disputeData.studentId,
        courseId: disputeData.courseId || null,
        studentName: disputeData.studentName || disputeData.studentId,
        matricNumber: disputeData.matricNumber || '',
        courseOfStudy: disputeData.courseOfStudy || '',
        locationDetails: { verified: false, source: 'dispute_approval' },
        status: 'Attended',
        timestamp: sessionTimestamp
      });
    }
  }
};

// Notifications
export const subscribeToNotifications = (userId, callback) => {
  const q = query(
    collection(db, 'notifications'),
    where('userId', '==', userId)
  );
  return onSnapshot(q, (snapshot) => {
    const notifications = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    // Sort in memory to avoid composite index requirement
    notifications.sort((a, b) => {
      const timeA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : (a.createdAt ? new Date(a.createdAt).getTime() : 0);
      const timeB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : (b.createdAt ? new Date(b.createdAt).getTime() : 0);
      return timeB - timeA;
    });

    callback(notifications.slice(0, 30));
  }, (error) => {
    console.error("Error in subscribeToNotifications: ", error);
  });
};

export const markNotificationAsRead = async (notificationId) => {
  const notifRef = doc(db, 'notifications', notificationId);
  await updateDoc(notifRef, { read: true });
};

export const markAllNotificationsAsRead = async (userId) => {
  const q = query(collection(db, 'notifications'), where('userId', '==', userId), where('read', '==', false));
  const snapshot = await getDocs(q);
  const promises = snapshot.docs.map(doc => updateDoc(doc.ref, { read: true }));
  await Promise.all(promises);
};

// ── Smart Board Casting ─────────────────────────────────────────
export const createBoardSession = async () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let pCode = '';
  for(let i=0; i<4; i++) pCode += chars.charAt(Math.floor(Math.random() * chars.length));

  const docRef = await addDoc(collection(db, 'boards'), {
    pairingCode: pCode,
    sessionId: null,
    linked: false,
    createdAt: serverTimestamp()
  });
  
  return { id: docRef.id, pairingCode: pCode };
};

export const subscribeToBoard = (boardId, callback) => {
  return onSnapshot(doc(db, 'boards', boardId), (docSnap) => {
    if (docSnap.exists()) {
      callback({ id: docSnap.id, ...docSnap.data() });
    }
  });
};

export const subscribeToSession = (sessionId, callback) => {
  return onSnapshot(doc(db, 'sessions', sessionId), (docSnap) => {
    if (docSnap.exists()) {
      callback({ id: docSnap.id, ...docSnap.data() });
    } else {
      callback(null);
    }
  });
};

export const linkBoardToSession = async (pairingCode, sessionId) => {
  const q = query(collection(db, 'boards'), where('pairingCode', '==', pairingCode.toUpperCase()), where('linked', '==', false));
  const snapshot = await getDocs(q);
  if (snapshot.empty) {
    throw new Error('Invalid or expired pairing code.');
  }
  
  const boardDoc = snapshot.docs[0];
  await updateDoc(boardDoc.ref, {
    linked: true,
    sessionId: sessionId
  });
  return true;
};

