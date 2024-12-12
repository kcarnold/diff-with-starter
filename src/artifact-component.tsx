import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Upload, FileText, AlertTriangle } from 'lucide-react';
import JSZip from 'jszip';
import * as Diff from 'diff';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const DiffViewer = () => {
  const [starterFiles, setStarterFiles] = useState({});
  const [allSubmissions, setAllSubmissions] = useState<Record<string, Record<string, string>>>({});
  const [currentStudent, setCurrentStudent] = useState<string | null>(null);
  const [diffs, setDiffs] = useState([]);
  const [error, setError] = useState('');

  const processZipFile = async (file, isStarter = false) => {
    try {
      const zip = new JSZip();
      const contents = await zip.loadAsync(file);
      const files = {};
      
      for (const [path, zipEntry] of Object.entries(contents.files)) {
        // Skip macOS special directories and non-Python files
        if (!zipEntry.dir && 
            !path.startsWith('__MACOSX/') && 
            path.endsWith('.py')) {
          const content = await zipEntry.async('string');
          // Normalize the path by taking just the filename
          const normalizedPath = path.split('/').pop() || path;
          files[normalizedPath] = content;
        }
      }
      
      if (isStarter) {
        setStarterFiles(files);
      }
    } catch (err) {
      setError('Error processing ZIP file: ' + err.message);
    }
  };

  const processStudentSubmission = async (zipEntry: JSZip.JSZipObject): Promise<Record<string, string>> => {
    const files: Record<string, string> = {};
    
    // If it's a zip file
    if (zipEntry.name.endsWith('.zip')) {
      const innerZip = new JSZip();
      const content = await zipEntry.async('blob');
      const innerContents = await innerZip.loadAsync(content);
      
      for (const [path, file] of Object.entries(innerContents.files)) {
        if (!file.dir && path.endsWith('.py') && !path.startsWith('__MACOSX/')) {
          // Normalize the path by taking just the filename
          const normalizedPath = path.split('/').pop() || path;
          files[normalizedPath] = await file.async('string');
        }
      }
    } 
    // If it's a Python file directly
    else if (zipEntry.name.endsWith('.py')) {
      const normalizedPath = zipEntry.name.split('/').pop() || zipEntry.name;
      files[normalizedPath] = await zipEntry.async('string');
    }
    
    return files;
  };

  const processSubmissionsZip = async (file: File) => {
    try {
      const zip = new JSZip();
      const contents = await zip.loadAsync(file);
      const submissions: Record<string, Record<string, string>> = {};
      
      for (const [path, zipEntry] of Object.entries(contents.files)) {
        // Look for student submission folders
        if (path.includes('_assignsubmission_file/') && !path.includes('_onlinetext')) {
          const studentName = path.split('_')[0];
          
          if (!zipEntry.dir) {
            const parentPath = path.split('/').slice(0, -1).join('/');
            if (!submissions[studentName]) {
              submissions[studentName] = {};
            }
            
            if (path.endsWith('.py') || path.endsWith('.zip')) {
              const studentFiles = await processStudentSubmission(zipEntry);
              submissions[studentName] = { ...submissions[studentName], ...studentFiles };
            }
          }
        }
      }
      
      setAllSubmissions(submissions);
      const firstStudent = Object.keys(submissions)[0];
      setCurrentStudent(firstStudent);
    } catch (err) {
      setError('Error processing submissions ZIP: ' + err.message);
    }
  };

  const handleNextStudent = () => {
    const students = Object.keys(allSubmissions);
    const currentIndex = students.indexOf(currentStudent!);
    const nextIndex = (currentIndex + 1) % students.length;
    setCurrentStudent(students[nextIndex]);
  };

  useEffect(() => {
    if (Object.keys(starterFiles).length && currentStudent) {
      console.log(`Generating diffs for ${currentStudent}...`);
      generateDiffs();
    }
  }, [starterFiles, currentStudent]);

  const generateDiffs = () => {
    if (!currentStudent) return;
    
    const submissionFiles = allSubmissions[currentStudent] || {};
    const diffResults = [];
    const allPaths = new Set([
      ...Object.keys(starterFiles),
      ...Object.keys(submissionFiles)
    ]);
    
    for (const path of allPaths) {
      const starterContent = starterFiles[path] || '';
      const submissionContent = submissionFiles[path] || '';
      
      if (starterContent !== submissionContent) {
        const diffLines = Diff.createPatch(
          path,
          starterContent,
          submissionContent,
          'starter',
          'submission'
        );

        const changes = Diff.structuredPatch(
          path,
          path,
          starterContent,
          submissionContent
        );

        diffResults.push({
          path,
          status: !starterContent ? 'added' : 
                 !submissionContent ? 'removed' : 
                 'modified',
          diffText: diffLines,
          hunks: changes.hunks
        });
      }
    }
    
    setDiffs(diffResults);
  };

  const handleDrop = async (e, isStarter) => {
    e.preventDefault();
    e.stopPropagation();
    
    const file = e.dataTransfer.files[0];
    if (file?.type === 'application/zip' || file?.name.endsWith('.zip')) {
      if (isStarter) {
        await processZipFile(file, true);
      } else {
        await processSubmissionsZip(file);
      }
    } else {
      setError('Please drop a ZIP file');
    }
  };

  const preventDefault = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  return (
    <div className="p-4 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Code Diff Viewer</h1>
      
      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div
          className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:bg-gray-50"
          onDrop={(e) => handleDrop(e, true)}
          onDragOver={preventDefault}
          onDragEnter={preventDefault}
        >
          <Upload className="mx-auto h-12 w-12 text-gray-400 mb-2" />
          <p>Drop starter code ZIP here</p>
          <p className="text-sm text-gray-500">
            {Object.keys(starterFiles).length} files loaded
          </p>
        </div>
        
        <div
          className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:bg-gray-50"
          onDrop={(e) => handleDrop(e, false)}
          onDragOver={preventDefault}
          onDragEnter={preventDefault}
        >
          <Upload className="mx-auto h-12 w-12 text-gray-400 mb-2" />
          <p>Drop student submissions ZIP here</p>
          <p className="text-sm text-gray-500">
            {Object.keys(allSubmissions).length} students loaded
          </p>
        </div>
      </div>

      {Object.keys(allSubmissions).length > 0 && (
        <div className="flex items-center gap-4 mb-6">
          <Select value={currentStudent || ''} onValueChange={setCurrentStudent}>
            <SelectTrigger className="w-[300px]">
              <SelectValue placeholder="Select a student" />
            </SelectTrigger>
            <SelectContent>
              {Object.keys(allSubmissions).map(student => (
                <SelectItem key={student} value={student}>
                  {student}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <Button onClick={handleNextStudent}>
            Next Student
          </Button>
          
          <span className="text-sm text-gray-500">
            {Object.keys(allSubmissions).length} submissions loaded
          </span>
        </div>
      )}

      {currentStudent && diffs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Changes for {currentStudent} ({diffs.length} files)</CardTitle>
          </CardHeader>
          <CardContent>
            {diffs.map((diff, index) => (
              <div key={index} className="mb-6 last:mb-0">
                <div className="flex items-center gap-2 mb-2">
                  <FileText className="h-4 w-4" />
                  <span className="font-medium">{diff.path}</span>
                  <span className={`text-sm px-2 py-1 rounded ${
                    diff.status === 'added' ? 'bg-green-100 text-green-800' :
                    diff.status === 'removed' ? 'bg-red-100 text-red-800' :
                    'bg-yellow-100 text-yellow-800'
                  }`}>
                    {diff.status}
                  </span>
                </div>
                <div className="bg-gray-50 rounded overflow-x-auto">
                  {diff.hunks.map((hunk, hunkIndex) => (
                    <div key={hunkIndex} className="border-b last:border-b-0">
                      <div className="bg-gray-100 px-4 py-1 text-sm text-gray-600">
                        @@ -{hunk.oldStart},{hunk.oldLines} +{hunk.newStart},{hunk.newLines} @@
                      </div>
                      <pre className="p-4 text-sm">
                        {hunk.lines.map((line, lineIndex) => (
                          <div
                            key={lineIndex}
                            className={`font-mono ${
                              line.startsWith('+') ? 'bg-green-50 text-green-900' :
                              line.startsWith('-') ? 'bg-red-50 text-red-900' :
                              ''
                            }`}
                          >
                            {line}
                          </div>
                        ))}
                      </pre>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default DiffViewer;