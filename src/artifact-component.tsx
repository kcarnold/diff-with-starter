import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Upload, FileText, AlertTriangle } from 'lucide-react';
import JSZip from 'jszip';
import * as Diff from 'diff';

const DiffViewer = () => {
  const [starterFiles, setStarterFiles] = useState({});
  const [submissionFiles, setSubmissionFiles] = useState({});
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
          files[path] = content;
        }
      }
      
      if (isStarter) {
        setStarterFiles(files);
      } else {
        setSubmissionFiles(files);
      }
    } catch (err) {
      setError('Error processing ZIP file: ' + err.message);
    }
  };

  useEffect(() => {
    if (Object.keys(starterFiles).length && Object.keys(submissionFiles).length) {
      console.log('Generating diffs...');
      generateDiffs();
    }
  }, [starterFiles, submissionFiles]);

  const generateDiffs = () => {
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
      await processZipFile(file, isStarter);
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
          <p>Drop student submission ZIP here</p>
          <p className="text-sm text-gray-500">
            {Object.keys(submissionFiles).length} files loaded
          </p>
        </div>
      </div>

      {diffs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Changes Found ({diffs.length})</CardTitle>
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